import readXlsxFile from "read-excel-file/node";
import fs from "fs";

export const readNumbers = async (pathToFile) => {
  let phoneNumbers = [];

  try {
    let rows = await readXlsxFile(pathToFile);

    for (let row of rows) {
      for (let value of row) {
        let result = String(value).match(/^((\+7|7|8)+([0-9]){10})$/g);
        if (result && result[0]) {
          phoneNumbers.push(
            ...result.map((num) =>
              num[0] === "8" ? "+7" + num.substring(1) : num
            )
          );
        }
      }
    }

    return phoneNumbers;
  } catch (err) {
    console.log(err);
  } finally {
    await new Promise((resolve, reject) =>
      fs.unlink(pathToFile, (err) => {
        if (err) {
          console.log(err);
          reject(err);
        }
        resolve();
      })
    );
  }

  return [];
};
