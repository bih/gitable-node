// Airtable to GitHub API response mappings
// See example of the `gh` object by running:
//   $ yarn cli github
//   $ cat cache/github/spotify/web-playback-sdk/*.json | jq '.records[0] | keys'

const createRef = gh => {
  const [org, repo, , issueNumber] = gh.html_url
    .replace('https://github.com/', '')
    .split('/');

  return `${org}/${repo}#${issueNumber}`;
};

const mappings = [
  ['Reference', createRef],
  ['Title', gh => gh.title],
  ['Type', gh => (gh.html_url.includes('/pull/') ? 'pull request' : 'issue')],
  ['Labels', gh => gh.labels.map(label => label.name)],
  ['Comments', gh => Number(gh.comments)],
  ['URL', gh => gh.html_url],
  ['Updated', gh => gh.updated_at],
  ['Project', gh => gh.repository_url.split('/').pop(), true], // true = If there's a change, also apply change to "Project Link Field"
  ['Created', gh => gh.created_at],
  ['State', gh => gh.state],
  ['Author', gh => gh.user.login, true], // true = If there's a change, also apply change to "Author Link Field"
  ['Source', () => 'GitHub'],
];

export default {
  createRef,
  mappings,
};
