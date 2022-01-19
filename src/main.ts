import fs from 'fs';

interface JsonExample {
    [exampleId: string]: {
        usage: string;
        from: string;
        to: string;
        in: string;
        prefix: string | undefined;
        suffix: string | undefined;
    };
}

interface Example {
    id: string;
    usage: string;
    from: FromMatcher;
    to: ToMatcher;
    in: string;
    prefix: string;
    suffix: string;
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
        return lines.map((line) => line.replace(indent, '')).join('\n');
    }
    return example;
}

function findBlankLineBefore(index: number, example: string): number {
    var currentNewlineIndex = example.lastIndexOf('\n', index - 1);
    if (currentNewlineIndex === -1) return -1;

    var previousNewlineIndex = example.lastIndexOf(
        '\n',
        currentNewlineIndex - 1
    );
    var previousBracket = example.lastIndexOf('{', currentNewlineIndex - 1);

    while (currentNewlineIndex !== -1) {
        if (
            (previousNewlineIndex !== -1 &&
                isBlank(
                    example.slice(previousNewlineIndex, currentNewlineIndex)
                )) ||
            (previousBracket !== -1 &&
                isBlank(
                    example.slice(previousBracket + 1, currentNewlineIndex)
                ))
        )
            return currentNewlineIndex + 1;
        else {
            currentNewlineIndex = previousNewlineIndex;
            previousNewlineIndex = example.lastIndexOf(
                '\n',
                currentNewlineIndex - 1
            );
            previousBracket = example.lastIndexOf('{', currentNewlineIndex - 1);
        }
    }
    return 0;
}

function findEndIndex(
    startIndex: number,
    open: string,
    close: string,
    example: string
): number {
    if (startIndex === -1) return -1;

    var openIndex = example.indexOf(open, startIndex);
    var closeIndex = startIndex;
    var opens = 1;

    if (openIndex === -1) return -1;

    do {
        closeIndex = example.indexOf(close, closeIndex + 1);
        if (closeIndex === -1) return -1;

        opens--;

        var tempOpenIndex: number;
        while (
            (tempOpenIndex = example.indexOf(open, openIndex + 1)) <
                closeIndex &&
            tempOpenIndex !== -1
        ) {
            opens++;
            openIndex = tempOpenIndex;
        }
    } while (opens !== 0);

    return closeIndex + 1;
}

function findNthElement(
    example: string,
    element: string,
    n: number,
    startIndex = 0
): number {
    if (n <= 0) return -1;

    var index = startIndex - 1;
    for (var i = 0; i < n; i++) {
        index = example.indexOf(element, index + 1);
        if (index === -1) break;
    }
    return index;
}

function findNthLastElement(
    example: string,
    element: string,
    n: number
): number {
    if (n <= 0) return -1;

    var index = example.length;
    for (var i = 0; i < n; i++) {
        index = example.lastIndexOf(element, index - 1);
        if (index === -1) return -1;
    }
    return index;
}

// Matchers:

interface Matcher {
    readonly keyword: string;
    readonly args: number[];
    readonly parseFrom: (args: string[]) => FromMatcher | null;
    readonly parseTo: (args: string[]) => ToMatcher | null;
}

const startMatcher: Matcher = {
    keyword: 'start',
    args: [0],
    parseFrom: (args: string[]) => (example: string) => 0,
    parseTo: (args: string[]) => (startIndex: number, example: string) => 0,
};

const groupMatcher: Matcher = {
    keyword: 'group',
    args: [1],
    parseFrom: (args: string[]): FromMatcher => {
        return (example: string): number => {
            const index = example.indexOf(args[0]);
            if (index != -1) {
                return findBlankLineBefore(index, example);
            }
            return index;
        };
    },
    parseTo: (args: string[]): ToMatcher => {
        return (startIndex: number, example: string): number => {
            return findEndIndex(example.indexOf(args[0]), '{', '}', example);
        };
    },
};

const firstMatcher: Matcher = {
    keyword: 'first',
    args: [1, 2],
    parseFrom: (args: string[]): FromMatcher | null => {
        try {
            const n = args.length === 1 ? 1 : Number.parseInt(args[0]);
            const element = args.length === 1 ? args[0] : args[1];

            return (example: string): number => {
                return findNthElement(example, element, n);
            };
        } catch (e) {
            // There will only ever be an error if there are 2 args
            console.log(
                'The nth position of the element %s in "from": "FIRST..." must be an integer, not %s',
                args[1],
                args[0]
            );
            return null;
        }
    },
    parseTo: (args: string[]): ToMatcher | null => {
        try {
            const n = args.length === 1 ? 1 : Number.parseInt(args[0]);
            const element = args.length === 1 ? args[0] : args[1];

            return (startIndex: number, example: string): number => {
                return findNthElement(example, element, n, startIndex + 1);
            };
        } catch (e) {
            // There will only ever be an error if there are 2 args
            console.log(
                'The nth position of the element %s in "to": "FIRST..." must be an integer, not %s',
                args[1],
                args[0]
            );
            return null;
        }
    },
};

const lastMatcher: Matcher = {
    keyword: 'last',
    args: [1, 2],
    parseFrom: (args: string[]): FromMatcher | null => {
        try {
            const n = args.length === 1 ? 1 : Number.parseInt(args[0]);
            const element = args.length === 1 ? args[0] : args[1];

            return (example: string): number => {
                return findNthLastElement(example, element, n);
            };
        } catch (e) {
            // There will only ever be an error if there are 2 args
            console.log(
                'The nth position of the element %s in "from": "LAST..." must be an integer, not %s',
                args[1],
                args[0]
            );
            return null;
        }
    },
    parseTo: (args: string[]): ToMatcher | null => {
        try {
            const n = args.length === 1 ? 1 : Number.parseInt(args[0]);
            const element = args.length === 1 ? args[0] : args[1];

            return (startIndex: number, example: string): number => {
                return findNthLastElement(example, element, n);
            };
        } catch (e) {
            // There will only ever be an error if there are 2 args
            console.log(
                'The nth position of the element %s in "to": "LAST..." must be an integer, not %s',
                args[1],
                args[0]
            );
            return null;
        }
    },
};

// Code Example Management:

function readJsonExample(filename: string): JsonExample {
    const rawJson: Buffer = fs.readFileSync(filename);
    return JSON.parse(rawJson.toString());
}

// function parseExample(exampleId: string, example: JsonExample): Example {
//     return {};
// }
