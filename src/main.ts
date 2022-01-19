import fs from "fs";

interface JsonExample {
    [exampleId: string]:
    {
        "usage": string,
        "from": string,
        "to": string,
        "in": string,
        "prefix": string | undefined,
        "suffix": string | undefined
    }
}

function readJsonExample(filename: string): JsonExample {
    const rawJson: Buffer = fs.readFileSync(filename);
    const jsonExample: JsonExample = JSON.parse(rawJson.toString());

    return jsonExample;
}