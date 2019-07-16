const fs = require('fs-extra');
const chalk = require('chalk');
const writeRecordsToCache = require('./../utils/writeRecordsToCache').default;

export default Airtable =>
  class {
    constructor({ airtable }) {
      const apiKey = airtable.AIRTABLE_API_KEY;
      const base = airtable.AIRTABLE_BASE_ID;

      this.instance = new Airtable({ apiKey }).base(base);
      this.issues = this.instance('Issues');
      this.authors = this.instance('Authors');
      this.projects = this.instance('Projects');
    }

    create(tableName, fields) {
      return new Promise((resolve, reject) => {
        this.instance(tableName).create(fields, (err, record) => {
          if (!err) {
            resolve(record.getId());
          } else {
            reject({ method: 'create', err, payload: { tableName, fields } });
          }
        });
      });
    }

    update(tableName, id, fields) {
      return new Promise((resolve, reject) => {
        this.instance(tableName).update(id, fields, (err, record) => {
          if (!err) {
            resolve(record.getId());
          } else {
            reject({
              method: 'update',
              err,
              payload: { tableName, id, fields },
            });
          }
        });
      });
    }

    getAllRecords(tableName, callback) {
      return new Promise((resolve, reject) => {
        var page = 1;
        this.instance(tableName)
          .select({ pageSize: 100 })
          .eachPage(
            (records, fetchNextPage) => {
              callback({ page, records });
              page++;
              fetchNextPage();
            },
            err => {
              !err ? resolve() : reject(err);
            }
          );
      });
    }

    async downloadFromAirtable(writeFolder) {
      var issueCount = 0;
      var authorCount = 0;
      var projectCount = 0;

      await fs.ensureDirSync(writeFolder);
      await fs.emptyDirSync(writeFolder);

      await this.getAllRecords('Issues', async ({ page, records }) => {
        issueCount += records.length;
        console.log(
          chalk.yellow(
            `⛴ | Issues | Downloaded: ${issueCount} | In Progress...`
          )
        );
        await writeRecordsToCache({
          writeFolder,
          writePrefix: 'Issues',
          page,
          records,
        });
      });

      await this.getAllRecords('Authors', async ({ page, records }) => {
        authorCount += records.length;
        console.log(
          chalk.blue(
            `⛴ | Authors | Downloaded: ${authorCount} | In Progress...`
          )
        );
        await writeRecordsToCache({
          writeFolder,
          writePrefix: 'Authors',
          page,
          records,
        });
      });

      await this.getAllRecords('Projects', async ({ page, records }) => {
        projectCount += records.length;
        console.log(
          chalk.gray(
            `⛴ | Projects | Downloaded: ${projectCount} | In Progress...`
          )
        );
        await writeRecordsToCache({
          writeFolder,
          writePrefix: 'Projects',
          page,
          records,
        });
      });

      return {
        issueCount,
        authorCount,
        projectCount,
      };
    }
  };
