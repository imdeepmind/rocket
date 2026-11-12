module.exports = {
  extends: [require.resolve('@commitlint/config-conventional', { paths: [__dirname + '/ross'] })],
  rules: {
    'type-enum': [2, 'always', ['feat', 'chore', 'ci', 'bug', 'refactor', 'test']],
    'header-max-length': [2, 'always', 120],
    'subject-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-match-issue': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'header-match-issue': ({ header }) => {
          // type(scope): #<NUMBER>: message
          const regex = /^(feat|chore|ci|bug|refactor|test)\([a-z0-9-]+\): #\d+: .+/;
          return [
            regex.test(header),
            `Commit message must follow the convention: type(scope): #<NUMBER>: message (e.g. feat(auth): #123: add token refresh)\nNumber refers to the GitHub issue.\nTypes: feat, chore, ci, bug, refactor, test`,
          ];
        },
      },
    },
  ],
};
