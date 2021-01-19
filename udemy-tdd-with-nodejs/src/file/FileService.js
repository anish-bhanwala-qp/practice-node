const fs = require('fs');
const path = require('path');
const config = require('config');
const { randomString } = require('../shared/generator');
const FileType = require('file-type');

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

const deleteProfileImage = async (filename) => {
  const filePath = path.join(profileFolder, filename);
  await fs.promises.unlink(filePath);
};

const isLessThan2Mb = (buffer) => {
  return buffer.length <= 1024 * 1024 * 2;
};

const isSupportedFileType = async (buffer) => {
  const type = await FileType.fromBuffer(buffer);
  return type && (type.mime === 'image/jpeg' || type.mime === 'image/png');
};

const FileService = {
  createFolders,
  saveProfileImage,
  deleteProfileImage,
  isLessThan2Mb,
  isSupportedFileType,
};
module.exports = FileService;
