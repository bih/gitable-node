const fs = require('fs-extra');
const chalk = require('chalk');
const writeRecordsToCache = require('./../utils/writeRecordsToCache').default;

export default GitHub =>
  class {
    constructor({ github }) {
      const githubToken = github.GITHUB_TOKEN;

      this.repositories = github.GITHUB_REPOSITORIES.map(orgWithRepo => [
        ...orgWithRepo.split('/'),
        orgWithRepo,
      ]);

      this.instance = new GitHub();
      this.instance.authenticate({
        type: 'token',
        token: githubToken,
      });
    }

    async getAllIssues(org, repo) {
      try {
        return await this.instance.paginate(
          'GET /repos/:owner/:repo/issues?state=all',
          {
            owner: org,
            repo,
          }
        );
      } catch (err) {
        if (err.message.match(/Bad credentials/)) {
          console.log(
            chalk.bold.red('✖ Invalid access token from GitHub.com\n'),
            '- Generate an access token from https://github.com/settings/tokens\n',
            '- Minimum scope required: public_repo'
          );
          process.exit(0);
        }

        if (err.message.match(/Not Found/)) {
          console.log(
            chalk.bold.red(
              '✖ Successful connection to GitHub, but repository not found on GitHub.com\n'
            ),
            '- Check your github.GITHUB_REPOSITORIES variable in your configuration.\n',
            '- The repository may not exist on GitHub.com, may be private, or you do not have the correct permissions.\n'
          );
          process.exit(0);
        }

        console.error(
          chalk.red.bold(
            '✖ An unexpected error with the GitHub API occurred:\n'
          ),
          err
        );
        process.exit(0);
      }
    }

    async downloadFromGitHub(writeFolder) {
      var count = this.repositories.reduce(
        (countObj, [, , orgWithRepo]) =>
          Object.assign({}, countObj, { [orgWithRepo]: 0 }),
        {}
      );

      await fs.ensureDirSync(writeFolder);
      await fs.emptyDirSync(writeFolder);

      const promises = this.repositories.map(
        async ([org, repo, orgWithRepo]) => {
          const records = await this.getAllIssues(org, repo);
          count[orgWithRepo] = records.length;

          await fs.ensureDirSync(`${writeFolder}${orgWithRepo}/`);
          await fs.emptyDirSync(`${writeFolder}${orgWithRepo}/`);

          await writeRecordsToCache({
            writeFolder: `${writeFolder}${orgWithRepo}/`,
            page: 1,
            records,
          });

          console.log(
            chalk.green(
              `✔ | GitHub Issues [${orgWithRepo}] | Downloaded: ${
                count[orgWithRepo]
              } | Completed`
            )
          );
        }
      );

      // Wait for all GitHub issues to be downloaded
      await Promise.all(promises);

      return count;
    }
  };
