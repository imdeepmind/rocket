module.exports = {
  names: ['no-hr', 'no-horizontal-rules'],
  description:
    'Horizontal rules (---) are not allowed in documentation content',
  tags: ['hr'],
  function: function noHr(params, onError) {
    for (const token of params.tokens) {
      if (token.type === 'hr') {
        onError({
          lineNumber: token.lineNumber,
          detail:
            "Horizontal rules ('---') are not allowed. Use markdown headings or whitespace instead.",
        });
      }
    }
  },
};

