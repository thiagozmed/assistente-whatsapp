// Imita o formato encadeável/thenable do PostgrestFilterBuilder real do
// supabase-js, só com os métodos que profileStore.js realmente usa.
function fakeQuery(result) {
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
}

module.exports = { fakeQuery };
