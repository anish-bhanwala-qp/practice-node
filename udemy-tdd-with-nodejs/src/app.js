const express = require('express');
const userRouter = require('./user/UserRouter');
const i18next = require('i18next');
const i18nextBackend = require('i18next-fs-backend');
const i18nextMiddleware = require('i18next-http-middleware');
const ErrorHandler = require('./errors/ErrorHandler');
const authRouter = require('./auth/AuthenticationRouter');
const tokenAuthentication = require('./middlewares/tokenAuthentication');
const FileService = require('./file/FileService');

i18next
  .use(i18nextBackend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    fallbackLng: 'en',
    lng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    backend: {
      loadPath: './locales/{{lng}}/{{ns}}.json',
    },
    detection: {
      lookupHeader: 'accept-language',
    },
  });

FileService.createFolders();

const app = express();

app.use(i18nextMiddleware.handle(i18next));

app.use(express.json());

app.use(tokenAuthentication);
app.use(userRouter);
app.use(authRouter);

app.use(ErrorHandler);

console.log('env :' + process.env.NODE_ENV);

module.exports = app;
