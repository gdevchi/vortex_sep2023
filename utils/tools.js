exports.isEmpty = (object, fields) => {
  let empty = false;
  for (let field of fields) {
    if (!object[field]) {
      empty = true;
      break;
    }
  }
  return empty;
};
