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

interface Example {
    id: string,
    usage: string,
    from: FromMatcher,
    to: ToMatcher,
    in: string,
    prefix: string,
    suffix: string,
}

type FromMatcher = (example: string) => number;
type ToMatcher = (startIndex: number, example: string) => number;

// Utilities:

const startingWhitespaceRegex = /^(\s+).*/;

function isBlank(str: string): boolean {
    return !str.replace(/\s/g, '').length;
}

function unindent(example: string): string {
    const lines = example.split('\n');
    if (!lines) return example;

    const match = lines[0].match(startingWhitespaceRegex);
    if (match) {
        const indent = match[1]; // Get the match
        return lines.map(line => line.replace(indent, '')).join('\n');
    }
    return example;
}

function findBlankLineBefore(index: number, example: string): number {
    var currentNewlineIndex = example.lastIndexOf('\n', index - 1);
    if (currentNewlineIndex === -1)
        return -1;

    var previousNewlineIndex = example.lastIndexOf('\n', currentNewlineIndex - 1);
    var previousBracket = example.lastIndexOf('{', currentNewlineIndex - 1);

    while (currentNewlineIndex !== -1) {
        if ((previousNewlineIndex !== -1 && isBlank(example.slice(previousNewlineIndex, currentNewlineIndex))) || 
            (previousBracket !== -1 && isBlank(example.slice(previousBracket + 1, currentNewlineIndex)))) 
            return currentNewlineIndex + 1;
        else {
            currentNewlineIndex = previousNewlineIndex;
            previousNewlineIndex = example.lastIndexOf('\n', currentNewlineIndex - 1);
            previousBracket = example.lastIndexOf('{', currentNewlineIndex - 1);
        }
    }
    return 0;
}

function findEndIndex(startIndex: number, open: string, close: string, example: string): number {
    if (startIndex === -1) return -1;

    var openIndex = example.indexOf(open, startIndex);
    var closeIndex = startIndex;
    var opens = 1;

    if (openIndex === -1)
        return -1;

    do {
        closeIndex = example.indexOf(close, closeIndex + 1);
        if (closeIndex === -1)
            return -1;

        opens--;

        var tempOpenIndex: number;
        while ((tempOpenIndex = example.indexOf(open, openIndex + 1)) < closeIndex && tempOpenIndex !== -1) {
            opens++;
            openIndex = tempOpenIndex;
        }
    }
    while (opens !== 0)

    return closeIndex + 1;
}

// Matchers:

interface Matcher {
    readonly keyword: string,
    readonly args: number,
    readonly parseFrom: (args: string[]) => FromMatcher | null,
    readonly parseTo: (args: string[]) => ToMatcher | null,
};

const fromStart: FromMatcher = (example) => 0;

function createFromGroupMatcher(group: string): FromMatcher {
    return function fromGroupMatcher(example: string): number {
        const index = example.indexOf(group);
        if (index != -1) {
            return findBlankLineBefore(index, example);
        }
        return index;
    }
}

function createToGroupMatcher(group: string): ToMatcher {
    return function toGroupMatcher(startIndex: number, example: string): number {
        return findEndIndex(example.indexOf(group), '{', '}', example);
    }
}

function createFromNthMatcher(element: string, n: number): FromMatcher {
    return function fromNthMatcher(example: string): number {
        var index = -1;
        for (var i = 0; i < n; i++) {
            index = example.indexOf(element, index + 1);
            if (index === -1)
                break;
        }
        return index;
    }
}

// Code Example Management:

function readJsonExample(filename: string): JsonExample {
    const rawJson: Buffer = fs.readFileSync(filename);
    return JSON.parse(rawJson.toString());
}

function parseExample(exampleId: string, example: JsonExample): Example {
    return { };
}