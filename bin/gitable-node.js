#!/usr/bin/env node

const commander = require('commander');
const chalk = require('chalk');
const { version } = require('../package.json');

const Application = require('../dist/application').default;

commander
  .command('airtable')
  .description('Synchronize records from Airtable')
  .option('-C, --config [configFile]', 'The configuration file', 'config.json')
  .option(
    '--airtable-folder [airtableCacheFolder]',
    'The Airtable cache folder',
    './cache/airtable/'
  )
  .action(async options => {
    try {
      const application = new Application({ commander });
      await application.configure(options.config);
      const output = await application.downloadFromAirtable(
        options.airtableFolder
      );
      console.log(chalk.cyan(output));
    } catch (err) {
      if (typeof err === 'string') {
        process.stdout.write(err.toString ? err.toString() : err);
        process.exit(0);
      } else {
        console.error(
          chalk.red.bold('✖ An unexpected error with Airtable occurred:\n'),
          err
        );
      }
    }
  });

commander
  .command('github')
  .description('Synchronize records from GitHub')
  .option('-C, --config [configFile]', 'The configuration file', 'config.json')
  .option(
    '--github-folder [githubCacheFolder]',
    'The GitHub cache folder',
    './cache/github/'
  )
  .action(async options => {
    try {
      const application = new Application({ commander });
      await application.configure(options.config);
      const output = await application.downloadFromGitHub(options.githubFolder);
      process.stdout.write(output);
    } catch (err) {
      if (typeof err === 'string') {
        process.stdout.write(err.toString ? err.toString() : err);
        process.exit(0);
      } else {
        console.error(
          chalk.red.bold('✖ An unexpected error with GitHub occurred:\n'),
          err
        );
      }
    }
  });

commander
  .command('cached-run')
  .description('Run the Airtable sync script (from cache)')
  .option('-C, --config [configFile]', 'The configuration file', 'config.json')
  .option(
    '--airtable-folder [airtableCacheFolder]',
    'The Airtable cache folder',
    './cache/airtable/'
  )
  .option(
    '--github-folder [githubCacheFolder]',
    'The GitHub cache folder',
    './cache/github/'
  )
  .action(async options => {
    try {
      const application = new Application({ commander });
      await application.configure(options.config);
      const output = await application.runCached(options);
      console.log(chalk.cyan(output));
    } catch (err) {
      if (typeof err === 'string') {
        process.stdout.write(err.toString());
        process.exit(0);
      } else if (err.message.match(/no such file or directory/)) {
        console.error(
          chalk.red.bold('✖ No data available for Airtable and/or GitHub.:\n'),
          'Run the following commands before running cached-run:\n',
          '- $ yarn cli github\n',
          '- $ yarn cli airtable\n',
          '- $ yarn cli cached-run\n'
        );
      } else {
        console.error(
          chalk.red.bold('✖ An unexpected error with cached-run occurred:\n'),
          err
        );
      }
    }
  });

commander
  .command('run')
  .description(
    'A full sync - download from GitHub, and Airtable, and apply changes to Airtable'
  )
  .option('-C, --config [configFile]', 'The configuration file', 'config.json')
  .option(
    '--airtable-folder [airtableCacheFolder]',
    'The Airtable cache folder',
    './cache/airtable/'
  )
  .option(
    '--github-folder [githubCacheFolder]',
    'The GitHub cache folder',
    './cache/github/'
  )
  .action(async options => {
    try {
      const application = new Application({ commander });
      await application.configure(options.config);
      const githubDownloadOutput = await application.downloadFromGitHub(
        options.githubFolder
      );
      console.log(chalk.cyan(githubDownloadOutput));

      const airtableDownloadOutput = await application.downloadFromAirtable(
        options.airtableFolder
      );
      console.log(chalk.cyan(airtableDownloadOutput));

      const runOutput = await application.runCached(options);
      console.log(chalk.cyan(runOutput));
    } catch (err) {
      if (typeof err === 'string') {
        process.stdout.write(err.toString ? err.toString() : err.toString);
        process.exit(0);
      } else {
        console.error(
          chalk.red.bold('✖ An unexpected error with the CLI occurred:\n'),
          err
        );
      }
    }
  });

commander
  .description('Synchronize GitHub Issues and Airtable (via Node.js)')
  .version(version, '-v, --version')
  .parse(process.argv);

if (commander.args.length === 0) {
  commander.outputHelp();
}
