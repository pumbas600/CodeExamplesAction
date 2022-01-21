import fs from 'fs';
import core from '@actions/core';
import github from '@actions/github';

interface JsonExample {
    usage: string;
    from: string;
    to: string;
    in: string;
    prefix: string | undefined;
    suffix: string | undefined;
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

interface Matcher {
    readonly keyword: string;
    readonly args: number[];
    readonly parseFrom: (args: string[]) => FromMatcher | null;
    readonly parseTo: (args: string[]) => ToMatcher | null;
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

const matchers: { [keyword: string]: Matcher | undefined } = {};

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
    args: [2, 1],
    parseFrom: (args: string[]): FromMatcher | null => {
        try {
            const n = args.length === 1 ? 1 : Number.parseInt(args[0]);
            const element = args.length === 1 ? args[0] : args[1];

            return (example: string): number => {
                return findNthElement(example, element, n);
            };
        } catch (e) {
            // The first argument is not a number
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
            // The first argument is not a number
            return null;
        }
    },
};

const lastMatcher: Matcher = {
    keyword: 'last',
    args: [2, 1],
    parseFrom: (args: string[]): FromMatcher | null => {
        try {
            const n = args.length === 1 ? 1 : Number.parseInt(args[0]);
            const element = args.length === 1 ? args[0] : args[1];

            return (example: string): number => {
                return findNthLastElement(example, element, n);
            };
        } catch (e) {
            // The first argument is not a number
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
            // The first argument is not a number
            return null;
        }
    },
};

registerMatchers(startMatcher, groupMatcher, firstMatcher, lastMatcher);

function registerMatchers(...matchers: Matcher[]) {
    matchers.forEach((matcher: Matcher) => {
        matchers[matcher.keyword] = matcher;
    });
}

function parseContext(context: string): [Matcher | undefined, string] {
    const splitContext = context.split(' ', 2);
    const keyword = splitContext[0].toLocaleLowerCase();
    const args = splitContext.length === 2 ? splitContext[1] : '';
    const matcher = matchers[keyword];

    return [matcher, args];
}

function parseMatchers(
    from: string,
    to: string
): [FromMatcher | null, ToMatcher | null] {
    const [fromMatcher, fromArgs] = parseContext(from);
    const [toMatcher, toArgs] = parseContext(to);

    if (!fromMatcher) {
        console.log('"from": "%s" does not specify a valid keyword', from);
        return [null, null];
    }
    if (!toMatcher) {
        console.log('"to": "%s" does not specify a valid keyword', to);
        return [null, null];
    }

    var parsedFromMatcher: FromMatcher | null = null;
    var parsedToMatcher: ToMatcher | null = null;

    // Loop through the possible number of args and use the first one which returns a valid matcher
    for (var i = 0; i < fromMatcher.args.length; i++) {
        const argCount = fromMatcher.args[i];
        const splitArgs = fromArgs.split(' ', argCount);
        if (splitArgs.length === argCount) {
            const matcher = fromMatcher.parseFrom(splitArgs);
            if (matcher) {
                parsedFromMatcher = matcher;
                break;
            }
        }
    }

    // Loop through the possible number of args and use the first one which returns a valid matcher
    for (var i = 0; i < toMatcher.args.length; i++) {
        const argCount = toMatcher.args[i];
        const splitArgs = toArgs.split(' ', argCount);
        if (splitArgs.length === argCount) {
            const matcher = toMatcher.parseTo(splitArgs);
            if (matcher) {
                parsedToMatcher = matcher;
                break;
            }
        }
    }

    return [parsedFromMatcher, parsedToMatcher];
}

// Code Example Management:

const examples: { [exampleIn: string]: Example | undefined } = {};

function readJsonExamples(filename: string): {
    [exampleId: string]: JsonExample;
} {
    const rawJson: Buffer = fs.readFileSync(filename);
    return JSON.parse(rawJson.toString());
}

function parseExample(exampleId: string, example: JsonExample): Example | null {
    const [fromMatcher, toMatcher] = parseMatchers(example.from, example.to);

    if (!fromMatcher || !toMatcher) return null;

    return {
        id: exampleId,
        usage: example.usage,
        from: fromMatcher,
        to: toMatcher,
        in: example.in,
        prefix: example.prefix ?? '',
        suffix: example.suffix ?? '',
    };
}

function registerExamples(filename: string) {
    const jsonExamples = readJsonExamples(filename);
    Object.keys(jsonExamples).forEach((exampleId: string) => {
        const jsonExample = jsonExamples[exampleId];
        const example = parseExample(exampleId, jsonExample);

        if (example) examples[example.in] = example;
    });
}

function checkForChanges() {}

async function run() {
    try {
        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const token = core.getInput('token', { required: true });
        const filename = core.getInput('filename');
        const prNumber = Number.parseInt(
            core.getInput('pr_number', { required: true })
        );

        const octokit = github.getOctokit(token);
        const { status } = await octokit.rest.pulls.checkIfMerged({
            owner: owner,
            repo: repo,
            pull_number: prNumber,
        });

        if ((status as Number) === 404) {
            // Not merged
            core.setFailed('The pull request specified has not been merged!');
            return;
        }

        // Load the examples json file
        registerExamples(filename);

        const { data: changedFiles } = await octokit.rest.pulls.listFiles({
            owner: owner,
            repo: repo,
            pull_number: prNumber,
        });

        changedFiles.forEach((file) => {
            if (file.status === 'unchanged') return;

            const lastSlashIndex = file.filename.lastIndexOf('/');
            const filename =
                lastSlashIndex === -1
                    ? file.filename
                    : file.filename.substring(lastSlashIndex + 1);

            const example = examples[filename];
            if (!example) return;

            const content = fs.readFileSync(file.filename).toString();
        });
    } catch (e) {
        const error = e as Error;
        core.setFailed(error.message);
    }
}
