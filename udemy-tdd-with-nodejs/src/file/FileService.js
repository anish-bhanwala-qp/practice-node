const fs = require('fs');
const path = require('path');
const config = require('config');
const { randomString } = require('../shared/generator');

const uploadFolder = path.join('.', config.uploadDir);
const profileFolder = path.join('.', config.uploadDir, config.profileDir);

const createFolders = () => {
  if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder);
  }

  if (!fs.existsSync(profileFolder)) {
    fs.mkdirSync(profileFolder);
  }
};

const saveProfileImage = async (base64File) => {
  const filename = randomString(8) + '.jpg';
  const imagePath = path.join(profileFolder, filename);
  await fs.promises.writeFile(imagePath, base64File, 'base64');
  return new Promise((resolve) => {
    fs.writeFile(imagePath, base64File, { encoding: 'base64' }, (error) => {
      if (!error) {
        resolve(filename);
      }
    });
  });
};

const FileService = { createFolders, saveProfileImage };
module.exports = FileService;
