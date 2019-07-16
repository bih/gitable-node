const { readOrWriteConfigFile } = require('./services/configFileService');

const Airtable = require('airtable');
const AirtableService = require('./services/airtableService').default(Airtable);

const GitHub = require('@octokit/rest');
const GitHubService = require('./services/githubService').default(GitHub);

const SyncService = require('./services/syncService').default;

const chalk = require('chalk');

export default class Application {
  constructor({ commander }) {
    this.commander = commander;
  }

  async configure(configFilePath) {
    this.config = await readOrWriteConfigFile({ configFilePath });
    this.airtableService = new AirtableService(this.config);
    this.githubService = new GitHubService(this.config);
    this.syncService = new SyncService({
      airtableService: this.airtableService,
      githubService: this.githubService,
      config: this.config,
    });
  }

  async downloadFromAirtable(writeFolder) {
    const {
      issueCount,
      authorCount,
      projectCount,
    } = await this.airtableService.downloadFromAirtable(writeFolder);

    return chalk.green(
      `✔ Stored ${issueCount} issues, ${authorCount} authors, and ${projectCount} projects to ${writeFolder}`
    );
  }

  async downloadFromGitHub(writeFolder) {
    const count = await this.githubService.downloadFromGitHub(writeFolder);
    const totalIssues = Object.values(count).reduce(
      (total, num) => (total += num)
    );

    let messages = [
      `✔ Completed GitHub sync with ${totalIssues} total issues\n`,
      ...Object.keys(count).map(repo => `- ${repo}: ${count[repo]} issues\n`),
    ];

    return messages.map(message => chalk.green(message)).join('');
  }

  async runCached(options = {}) {
    return await this.syncService.perform(options);
  }
}
