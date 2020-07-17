const git = require("git-last-commit");

const loadGitInfo = async () => {
    return new Promise((resolve, reject) => {
        git.getLastCommit((err, commit) => {
            console.log(commit)
            resolve(commit)
        });
    })
};

module.exports = { loadGitInfo }
