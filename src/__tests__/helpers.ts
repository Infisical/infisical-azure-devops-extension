import { commandFromString } from "azure-pipelines-task-lib/taskcommand";

export interface SetVariableCall {
    name: string;
    value: string;
    isSecret: boolean;
    isOutput: boolean;
}

export interface TaskComplete {
    result: "Succeeded" | "SucceededWithIssues" | "Failed";
    message: string;
}

export function parseSetVariables(stdout: string): SetVariableCall[] {
    const calls: SetVariableCall[] = [];
    for (const line of stdout.split(/\r?\n/)) {
        if (!line.startsWith("##vso[task.setvariable")) continue;
        const cmd = commandFromString(line);
        calls.push({
            name: cmd.properties?.["variable"] ?? "",
            value: cmd.message ?? "",
            isSecret: cmd.properties?.["issecret"] === "true",
            isOutput: cmd.properties?.["isOutput"] === "true",
        });
    }
    return calls;
}

export interface StdoutCapture {
    stop: () => string;
    complete: Promise<TaskComplete>;
}

export function captureStdout(): StdoutCapture {
    const chunks: string[] = [];
    let resolveComplete!: (info: TaskComplete) => void;
    const complete = new Promise<TaskComplete>((resolve) => {
        resolveComplete = resolve;
    });
    const original = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
        const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString();
        chunks.push(text);
        for (const line of text.split(/\r?\n/)) {
            if (!line.startsWith("##vso[task.complete")) continue;
            const cmd = commandFromString(line);
            const resultName = cmd.properties?.["result"];
            if (
                resultName === "Succeeded" ||
                resultName === "SucceededWithIssues" ||
                resultName === "Failed"
            ) {
                resolveComplete({ result: resultName, message: cmd.message ?? "" });
            }
        }
        return true;
    }) as typeof process.stdout.write;
    return {
        stop: () => {
            process.stdout.write = original;
            return chunks.join("");
        },
        complete,
    };
}

const MANAGED_ENV_PREFIXES = [
    "INPUT_",
    "ENDPOINT_URL_",
    "ENDPOINT_AUTH_",
    "SECRET_",
    "VSTS_TASKVARIABLE_",
    "SECUREFILE_TICKET_",
    "SYSTEM_",
];

export function clearTaskEnv(): void {
    for (const key of Object.keys(process.env)) {
        if (MANAGED_ENV_PREFIXES.some((p) => key.startsWith(p))) {
            delete process.env[key];
        }
    }
}

export function resetTaskLibLoadFlag(): void {
    delete (globalThis as unknown as Record<string, unknown>)["_vsts_task_lib_loaded"];
}

function variableKey(name: string): string {
    return name.replace(/\./g, "_").replace(/ /g, "_").toUpperCase();
}

export function setInput(name: string, value: string): void {
    process.env[`INPUT_${variableKey(name)}`] = value;
}

export interface EndpointSetup {
    url: string;
    scheme: string;
    parameters?: Record<string, string>;
}

export function setEndpoint(connectionId: string, setup: EndpointSetup): void {
    process.env[`ENDPOINT_URL_${connectionId}`] = setup.url;
    process.env[`ENDPOINT_AUTH_SCHEME_${connectionId}`] = setup.scheme;
    if (setup.parameters) {
        for (const [key, value] of Object.entries(setup.parameters)) {
            process.env[`ENDPOINT_AUTH_PARAMETER_${connectionId}_${key.toUpperCase()}`] = value;
        }
    }
}
