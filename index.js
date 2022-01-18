const core = require('@actions/core');
const github = require('@actions/github');

const main = async () => {
    try {

        const owner = core.getInput('owner', { required: true });
        const repo = core.getInput('repo', { required: true });
        const prNumber = core.getInput('pr_number', { required: true });
        const token = core.getInput('token', { required: true });

        const octokit = new github.getOctokit(token);

        // TODO: Check pr_number is actually number
 
        const { data: hasBeenMerged } = await octokit.rest.pulls.checkIfMerged({ owner, repo, prNumber });

        if (!hasBeenMerged) {
            core.setFailed('The pull request specified has not been merged!');
            return;
        }

        // TODO: Check if the PR was merged into the correct branch

        
        const { data: changedFiles } = await octokit.rest.pulls.listFiles({ owner, repo, prNumber });
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

const keyWords = [ 'FROM', 'START', 'END', 'TO', 'BLANKLINE', 'IN', 'METHOD', 'CLASS', 'PREFIX', 'SUFFIX' ]
const startingWhitespaceRegex = /^(\s+).*/;
const requiredExampleFields = [ "usage", "from", "to", "in" ];
const examples = { };


function isBlank(str) {
    return !str.replace(/\s/g, '').length;
}

function findEndIndex(startIndex, open, close, example) {
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

        var tempOpenIndex;
        while ((tempOpenIndex = example.indexOf(open, openIndex + 1)) < closeIndex && tempOpenIndex !== -1) {
            opens++;
            openIndex = tempOpenIndex;
        }
    }
    while (opens !== 0)

    return closeIndex + 1;
}

function fromStartMatcher(example) {
    return 0;
}

function toBlankMatcher(startIndex, example) {
    const index = example.indexOf('\n\n', startIndex + 1);
    return index === -1 ? index : index - 2;
}

function findBlankLineBefore(index, example) {
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

function createGroupMatchers(group) {
    function fromGroupMatcher(example) {
        const index = example.indexOf(group);
        if (index != -1) {
            return findBlankLineBefore(index, example);
        }
        return index;
    }

    function toGroupMatcher(startIndex, example) {
        return findEndIndex(example.indexOf(group), '{', '}', example);
    }

    return [ createFromGroupMatcher(group), createToGroupMatcher(group) ];
}

function createFromGroupMatcher(group) {
    return function fromGroupMatcher(example) {
        const index = example.indexOf(group);
        if (index != -1) {
            return findBlankLineBefore(index, example);
        }
        return index;
    }
}

function createToGroupMatcher(group) {
    return function toGroupMatcher(startIndex, example) {
        return findEndIndex(example.indexOf(group), '{', '}', example);
    }
}

function createFromNthMatcher(element, n) {
    return function fromNthMatcher(example) {
        var index = -1;
        for (var i = 0; i < n; i++) {
            index = example.indexOf(element, index + 1);
            if (index === -1)
                break;
        }
        return index;
    }
}

function unindent(example) {
    const lines = example.split('\n');
    if (!lines) return example;

    const match = lines[0].match(startingWhitespaceRegex);
    if (match) {
        const indent = match[1]; // Get the match
        return lines.map(line => line.replace(indent, '')).join('\n');
    }
    return example;
}

function isKeyWord(word) {
    return keyWords.includes(word);
}

function parseFrom(from) {
    const keys = from.split(" ", 2);
    if (keys) {
        switch(keys[0]) {
            case 'GROUP': {
                if (keys.length === 2) {
                    return createFromGroupMatcher(keys[1]);
                }
                console.log('When using GROUP, you must specify the name of the group');
                break;
            }

            case 'START':
                return fromStartMatcher;

            case 'FIRST': {
                if (keys.length === 2) {
                    return createFromNthMatcher(keys[1], 1);
                }
                console.log('When using FIRST, you must specify what you want to find the first of');
                break;
            }
        }
    }

    return null;
}

function parseTo(to) {

}

function parseExample(exampleId, example) {
    
    const hasRequiredFields = requiredExampleFields.every(field => example[field]);
    if (!hasRequiredFields) {
        console.log('Missing one of the required fields: %s', requiredExampleFields);
    }

    const fromMatcher = parseFrom(example.from);
    const toMatcher = parseTo(example.to);

    if (!fromMatcher || !toMatcher)
        console.log('Either your from expression (%s) or your to expression (%s) is invalid.', example.from, example.to);

    const details = {
        id: exampleId,
        usage: example.usage,
        fromMatcher: fromMatcher,
        toMatcher: toMatcher,
        in: example.in
    };

    examples[details.in] = [...examples[details.in], details]; 
}

//main();

function test() {
    const example =
`public class Example {
    /**
     * An example description
     */
    @Test({ "hi", "hello" })
    public int demoFunction(int numA, int numB) {
        if (numA < numB) {
            return -1;
        }

        return numA + numB;
    }

    public int zero() {
        return 0;
    }
}`

    const [fromMatcher, toMatcher] = createGroupMatchers('Example');
    const from = fromMatcher(example);
    const to = toMatcher(from, example)
    
    console.log('From: %d To: %d', from, to);

    console.log(unindent(example.slice(from, to)));
}

test();
