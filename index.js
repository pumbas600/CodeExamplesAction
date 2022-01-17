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

function findEndIndex(startIndex, open, close, example) {
    if (startIndex === -1) return -1;

    var openIndex = example.indexOf(open, startIndex);
    var closeIndex = example.indexOf(close, startIndex + 1);
    if (openIndex === -1 || closeIndex === -1) return -1;

    var opens = 1;
    while (opens != 0 && closeIndex !== -1) {
        openIndex = example.indexOf(open, openIndex + 1);
        if (openIndex !== -1 && openIndex < closeIndex) {
            opens++;
            closeIndex = example.indexOf(close, closeIndex + 1);
            if (closeIndex === -1) return -1;
        }
        else
            opens--;
    }

    return closeIndex;
}

function findStartIndex(startIndex, open, close, example) {
    if (startIndex === -1) return -1;

    var openIndex = example.indexOf(open, startIndex);
    var closeIndex = example.indexOf(close, startIndex + 1);
    if (openIndex === -1 || closeIndex === -1) return -1;

    var opens = 1;
    while (opens != 0 && closeIndex !== -1) {
        openIndex = example.indexOf(open, openIndex + 1);
        if (openIndex !== -1 && openIndex < closeIndex) {
            opens++;
            closeIndex = example.indexOf(close, closeIndex + 1);
            if (closeIndex === -1) return -1;
        }
        else
            opens--;
    }

    return closeIndex;
}

function fromStartMatcher(example) {
    return 0;
}

function toBlankMatcher(startIndex, example) {
    const index = example.indexOf('\n\n', startIndex + 1);
    return index === -1 ? index : index - 2;
}

function createMethodMatchers(method) {
    function fromMethodMatcher(example) {
        const index = example.indexOf(method);
        if (index != -1) {
            for (i = index - 1; i > 0; i--) {

                if (example[i] === '\n' && example[i - 1] === '\n')
                    return i + 1;
            }
            return 0;
        }
        return index;
    }

    function toMethodMatcher(startIndex, example) {
        return findEndIndex(example.indexOf(method), '{', '}', example);
    }

    return [ fromMethodMatcher, toMethodMatcher ];
}

function isKeyWord(word) {
    return keyWords.includes(word);
}

function parseExample(example) {

}

//main();

function test() {
    const example =
    `class Example {
        
        function demoFunction(numA, numB) {
            if (numA < numB) return -1;

            return numA + numB;
        }
    }`

    const [fromMatcher, toMatcher] = createMethodMatchers('demoFunction');
    const from = fromMatcher(example);
    const to = toMatcher(from, example)
    
    console.log('From: %d To: %d', from, to);

    console.log(example.slice(from, to + 1));
}

test();
