module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'chore', 'ci', 'bug']],
    'header-max-length': [2, 'always', 120],
    'subject-case': [0], // Disable to allow JIRA key
    'subject-empty': [2, 'never'],
    'type-case': [2, 'always', 'lower-case'],
    'scope-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    'header-match-jira': [2, 'always'],
  },
  plugins: [
    {
      rules: {
        'header-match-jira': ({ header }) => {
          // type(scope): ROSS-NUMBER: message
          const regex = /^(feat|chore|ci|bug)\([a-z-]+\): ROSS-\d+: .+/;
          return [
            regex.test(header),
            'Commit message must follow the convention: type(scope): ROSS-<NUMBER>: message\nTypes: feat, chore, ci, bug',
          ];
        },
      },
    },
  ],
};
