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
            core.setFailed("The pull request specified has not been merged!");
            return;
        }

        // TODO: Check if the PR was merged into the correct branch

        
        const { data: changedFiles } = await octokit.rest.pulls.listFiles({ owner, repo, prNumber });
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

main();