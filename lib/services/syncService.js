const fs = require('fs-extra');
const chalk = require('chalk');
const batchPromises = require('batch-promises');

const {
  createRef: createGitHubToAirtableRef,
  mappings: getGitHubToAirtableMappings,
} = require('./mappings/githubToAirtableMappings').default;

export default class SyncService {
  constructor({ airtableService, githubService, config }) {
    this.airtableService = airtableService;
    this.githubService = githubService;
    this.config = config;
  }

  async getAirtableRecordsFromCache(options) {
    const files = (await fs.readdirSync(options.airtableFolder)).map(file =>
      file.split('.')
    );

    const issues = files.filter(([tableName]) => tableName === 'Issues');
    const authors = files.filter(([tableName]) => tableName === 'Authors');
    const projects = files.filter(([tableName]) => tableName === 'Projects');

    const sortFilesFn = (a, b) => Number(a[1]) - Number(b[1]);

    const toSingleJson = async list => {
      const promiseArray = list
        .sort(sortFilesFn)
        .map(file => options.airtableFolder + file.join('.'))
        .map(async path => await fs.readJSONSync(path));
      const contentsArray = await Promise.all(promiseArray);
      return contentsArray.reduce(
        (array, { records }) => array.concat(records),
        []
      );
    };

    return {
      issues: await toSingleJson(issues),
      authors: await toSingleJson(authors),
      projects: await toSingleJson(projects),
    };
  }

  async getGitHubIssuesFromCache(options) {
    const repositories = this.config.github.GITHUB_REPOSITORIES;

    const promises = repositories
      .map(repository => `${options.githubFolder}${repository}/1.json`)
      .map(async path => await fs.readJSONSync(path));

    const contentsArray = await Promise.all(promises);
    return contentsArray.reduce(
      (array, { records }) => array.concat(records),
      []
    );
  }

  githubIssueDiff({ airtableRecord, githubIssue, mappings }) {
    const arrayArrayToPureObj = (obj, [k, v]) => Object.assign(obj, { [k]: v });
    const pureObjToArrayArray = obj =>
      Object.keys(obj).reduce((array, k) => [...array, [k, obj[k]]], []);

    const parseDateElseFalse = date => {
      try {
        return Number(Date.parse(date));
      } catch (err) {
        return false;
      }
    };

    const newRecordArray = mappings.map(([airtableColumn, fn]) => [
      airtableColumn,
      fn(githubIssue),
    ]);
    const newRecord = newRecordArray.reduce(arrayArrayToPureObj, {});

    if (!airtableRecord) {
      return {
        action: 'create',
        ref: newRecord.Reference,
        fields: newRecord,
      };
    }

    const existingRecordArray = Object.keys(airtableRecord)
      .map(key => [key, airtableRecord[key]])
      .filter(([k]) => 'id' === k || mappings.map(([key]) => key).includes(k));
    const existingRecord = existingRecordArray.reduce(arrayArrayToPureObj, {});

    let updatedFields = pureObjToArrayArray(
      Object.assign({}, newRecord, existingRecord)
    )
      .filter(([key, value]) => {
        const match = newRecordArray.find(([k]) => key === k);
        const matchValue = match ? match[1] : null;

        if (key === 'Labels') {
          return JSON.stringify(value.sort()) !== JSON.stringify(matchValue.sort());
        }

        if (key === 'Created' || key === 'Updated') {
          return parseDateElseFalse(value) !== parseDateElseFalse(matchValue);
        }

        return value !== matchValue;
      })
      .map(([key, value]) => [key, key in newRecord ? newRecord[key] : value])
      .reduce(arrayArrayToPureObj, {});

    const updatedAirtableId = updatedFields.id;
    delete updatedFields.id;

    if (JSON.stringify(updatedFields) === '{}') {
      return null;
    }

    mappings
      .filter(array => array.length > 2)
      .filter(([, , hasLinkField]) => hasLinkField === true)
      .filter(([key]) => typeof updatedFields[key] !== 'undefined')
      .forEach(([key]) => {
        updatedFields[`${key} Link Field`] = updatedFields[key];
      });

    return {
      action: 'update',
      id: updatedAirtableId,
      ref: newRecord.Reference,
      fields: updatedFields,
    };
  }

  diff(airtable, github) {
    // TODO: By design, does not support deleting things from Airtable.
    return github
      .map(githubIssue => {
        return this.githubIssueDiff({
          mappings: getGitHubToAirtableMappings,
          githubIssue,
          airtableRecord: airtable.issues
            .filter(issue => issue.Source === 'GitHub')
            .find(
              issue =>
                issue.Reference === createGitHubToAirtableRef(githubIssue)
            ),
        });
      })
      .filter(changeDiff => changeDiff !== null);
  }

  applyChangesToAirtable(changeDiff) {
    return new Promise((resolve, reject) => {
      let failedRequests = [];

      const recordCreations = changeDiff
        .filter(change => change.action === 'create')
        .map(change => async () => {
          try {
            await this.airtableService.create('Issues', change.fields);
          } catch (err) {
            failedRequests.push(change);
          }

          console.log(chalk.blue('- %s', JSON.stringify(change)));
        });

      const recordModifications = changeDiff
        .filter(change => change.action === 'update')
        .map(change => async () => {
          try {
            await this.airtableService.update(
              'Issues',
              change.id,
              change.fields
            );
          } catch (err) {
            failedRequests.push(change);
          }

          console.log(chalk.yellow('- %s', JSON.stringify(change)));
        });

      const promises = [...recordCreations, ...recordModifications];

      batchPromises(
        25,
        promises,
        promise =>
          new Promise((batchResolve, batchReject) => {
            setTimeout(
              () =>
                promise()
                  .then(batchResolve)
                  .catch(batchReject),
              1000
            );
          })
      )
        .then(() => resolve({ failedRequests }))
        .catch(reject);
    });
  }

  async perform(options) {
    const isFoldersEmpty =
      (await fs.pathExistsSync(options.airtableFolder)) === false ||
      (await fs.pathExistsSync(options.githubFolder)) === false;

    if (isFoldersEmpty) {
      console.log(
        chalk.bold.red(
          '✖ You have not ran either `./bin/gitable-node.js airtable` or `./bin/gitable-node.js github` yet.'
        )
      );
      process.exit(0);
    }

    const airtable = await this.getAirtableRecordsFromCache(options);
    if (airtable.length === 0) {
      console.log(
        chalk.bold.red(
          '✖ No local backup of your Airtable data exists. Run `./bin/gitable-node.js airtable`.'
        )
      );
      process.exit(0);
    }
    console.log(chalk.green('✔ Established connection with Airtable API'));

    const github = await this.getGitHubIssuesFromCache(options);
    if (github.length === 0) {
      console.log(
        chalk.bold.red(
          '✖ No local backup of your GitHub issues exists. Run `./bin/gitable-node.js github`.'
        )
      );
      process.exit(0);
    }

    console.log(chalk.green('✔ Calculated changes to perform ...'));
    const calculateDiff = this.diff(airtable, github);

    try {
      console.log(chalk.blue('⛴  Applying changes to Airtable ...'));
      const { failedRequests } = await this.applyChangesToAirtable(
        calculateDiff
      );
      var failedRequestsLength = failedRequests.length;
      console.log(
        chalk.bold.red('✖ %i Failed Requests'),
        failedRequests.length
      );
      failedRequests.forEach((failedRequest, index) => {
        console.log(
          chalk.red('- [%i]: %s'),
          index,
          JSON.stringify(failedRequest)
        );
      });
    } catch (err) {
      console.log(
        chalk.bold.red(
          '✖ An error occurred whilst trying to apply changes to Airtable:\n'
        ),
        err
      );
    } finally {
      await fs.emptyDirSync(options.githubFolder);
      await fs.emptyDirSync(options.airtableFolder);

      const recordsCreated = calculateDiff.filter(
        diff => diff.action === 'create'
      ).length;
      const recordsUpdated = calculateDiff.filter(
        diff => diff.action === 'update'
      ).length;

      console.log(
        chalk.green(
          '✔ Changes applied! %i issues were added, %i issues were updated, and %i changes failed.'
        ),
        recordsCreated,
        recordsUpdated,
        failedRequestsLength
      );
    }

    return 'Finished!';
  }
}
