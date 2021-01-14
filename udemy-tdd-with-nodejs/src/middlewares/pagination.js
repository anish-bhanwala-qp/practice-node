module.exports = (req, res, next) => {
  const pageAsNumber = Number.parseInt(req.query.page);
  const pageSizeAsNumber = Number.parseInt(req.query.pageSize);

  let page = Number.isNaN(pageAsNumber) ? 0 : pageAsNumber;
  if (page < 0) {
    page = 0;
  }
  let pageSize = Number.isNaN(pageSizeAsNumber) ? 10 : pageSizeAsNumber;
  if (pageSize > 10 || pageSize < 1) {
    pageSize = 10;
  }

  req.pagination = { page, pageSize };
  next();
};
