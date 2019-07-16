const fs = require('fs');
const chalk = require('chalk');

const configStructure = {
  airtable: {
    AIRTABLE_API_KEY: '',
    AIRTABLE_BASE_ID: '',
  },
  github: {
    GITHUB_TOKEN: '',
    GITHUB_REPOSITORIES: [],
  },
};

const createDefaultConfigFile = async defaultConfigPath =>
  await fs.writeFileSync(
    defaultConfigPath,
    JSON.stringify(configStructure, null, 2)
  );

const validateConfigStructure = object => {
  let errors = [];
  const validateKeys = name =>
    Object.keys(configStructure[name])
      .filter(key => !(key in object[name]) || object[name][key] === '')
      .forEach(missingKey =>
        errors.push(
          `Missing or empty key from configuration: ${name}.${missingKey}`
        )
      );

  validateKeys('airtable');
  validateKeys('github');
  return errors;
};

export async function readOrWriteConfigFile({ configFilePath }) {
  if (!configFilePath) {
    throw new Error(
      chalk.red.bold('✖ configFilePath is not defined.') +
        'To fix, run the following command:\n' +
        '$ ./bin/gitable-node.js run --config config.json\n'
    );
  }

  const configFileExists = await fs.existsSync(configFilePath);

  if (!configFileExists) {
    await createDefaultConfigFile(configFilePath);
    console.log(
      chalk.red.bold(
        '✔ Could not find configuration file for %s. Creating file...'
      ),
      configFilePath
    );
    console.log(
      chalk.green('✔ Default configuration created at %s'),
      configFilePath
    );
    process.exit(0);
  }

  try {
    var configContents = await fs.readFileSync(configFilePath, 'utf8');
    var configJson = JSON.parse(configContents);
  } catch (err) {
    throw new Error(
      chalk.red.bold('✖ configFilePath contains invalid JSON.\n') +
        `Filepath: ${configFilePath}\n` +
        err.toString()
    );
  }

  const validationErrors = validateConfigStructure(configJson);
  if (validationErrors.length > 0) {
    throw new Error(
      chalk.red.bold(
        '✖ configFilePath contains invalid JSON configuration.\n'
      ) +
        validationErrors.join('\n').toString() +
        '\n'
    );
  }
  console.log(chalk.green('✔ Reading configuration from %s'), configFilePath);
  return configJson;
}
