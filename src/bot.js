import axios from "axios";
import fs from "fs";
import TelegramBotApi from "node-telegram-bot-api";
import Excel from "exceljs";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { v4 as uuidv4 } from "uuid";

import {
  CONFNAME,
  INFO,
  INSTRUCTIONS,
  MAIN_MENU,
  YANDEXDISC_URL,
  TIME_ZONE,
} from "./const.js";

class Bot {
  constructor() {
    this.config = JSON.parse(
      fs.readFileSync(CONFNAME) ||
        `{
          "botToken": "5716255450:AAFDSi8PlpUKDykuk8V61I0cl4smXHFL3KI",
          "data": {}
        }`
    );

    this.bot = new TelegramBotApi(this.config.botToken, { polling: true });

    this.listtenersInit();
  }

  listtenersInit() {
    // на старте проверяем авторизацию
    this.bot.onText(/\/start/, async (msg) => {
      return this.showMainMenu(msg.from.id, true);
      // return this.bot.sendMessage(msg.from.id, INFO);
    });

    // вывод информации о проекте
    this.bot.onText(new RegExp(MAIN_MENU.INFO), (msg) => {
      return this.bot.sendMessage(msg.from.id, INFO);
    });

    // вывод инструкции по использованию
    this.bot.onText(new RegExp(MAIN_MENU.INSTRUCTIONS), (msg) => {
      return this.bot.sendMessage(msg.from.id, INSTRUCTIONS);
    });

    // старт трек
    this.bot.onText(new RegExp(MAIN_MENU.START), this.startTrack.bind(this));

    // старт трек
    this.bot.onText(/\/go/, this.startTrack.bind(this));

    // стоп трек
    this.bot.onText(new RegExp(MAIN_MENU.STOP), this.stopTrack.bind(this));
    // стоп трек
    this.bot.onText(/\/end/, this.stopTrack.bind(this));

    // текущие таски
    this.bot.onText(new RegExp(MAIN_MENU.CURRENT_TASKS), (msg) => {
      const userId = msg.from.id;

      const tasksAnswer = Object.values(this.config.data[userId] || {})
        .filter((task) => !task.end)
        .map((task) => `\nЗадача: ${task.name}\nВремя начала: ${task.start}`)
        .join("\n");
      const answer = `Текущие задачи:\n` + tasksAnswer;
      return this.bot.sendMessage(userId, answer);
    });

    // все таски
    this.bot.onText(new RegExp(MAIN_MENU.ALL_TASKS), (msg) => {
      const userId = msg.from.id;

      const tasksAnswer = Object.values(this.config.data[userId] || {})
        .map(
          (task) =>
            `\nЗадача: ${task.name}\nВремя начала: ${task.start}${
              task.end
                ? `\nВремя окончания: ${task.end}\nРазница: ${task.diff}`
                : ""
            }`
        )
        .join("\n");
      const answer = `Все задачи:\n` + tasksAnswer;
      return this.bot.sendMessage(userId, answer);
    });

    // Выгрузка
    this.bot.onText(new RegExp(MAIN_MENU.DOWNLOAD), async (msg) => {
      const userId = msg.from.id;
      const excelBuffer = await this.createExcelBuffer(userId);

      return this.bot.sendDocument(
        userId,
        excelBuffer,
        {
          caption: "Ку Нустя",
        },
        {
          filename: "Mommy.xlsx",
          contentType:
            "application/application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }
      );
    });

    this.bot.on("callback_query", async (callbackQuery) => {
      const action = callbackQuery.data;
      const msg = callbackQuery.message;
      const userId = msg.chat.id;
      console.log(userId);

      if (action === "Назад") {
        return this.showMainMenu(msg.chat.id);
      }

      const taskName = action;
      const taskObject = Object.values(this.config.data[userId]).find(
        (task) => task.name === taskName
      );
      const startDate = taskObject.start;
      const endDate = format(Date.now(), "HH:mm:ss yyyy-MM-dd");

      const sDateObject = new Date(startDate);
      const eDateObject = new Date(endDate);

      const duration = intervalToDuration({
        start: 0,
        end: eDateObject - sDateObject,
      });

      const zeroPad = (num) => String(num).padStart(2, "0");

      const formatted = formatDuration(duration, {
        // format: ["minutes", "seconds"],
        format: ["hours", "minutes", "seconds"],
        zero: true,
        delimiter: ":",
        locale: {
          formatDistance: (_token, count) => zeroPad(count),
        },
      });

      if (taskObject.id) {
        this.config.data[userId][taskObject.id].end = endDate;
        this.config.data[userId][taskObject.id].diff = formatted;
      } else {
        // задачи из старой версии, у них нет id
        this.config.data[userId][taskName].end = endDate;
        this.config.data[userId][taskName].diff = formatted;
      }

      console.log(formatted);

      this.saveToFile();
      this.saveToDisk(userId);

      return this.bot.sendMessage(
        msg.chat.id,
        `Задача "${taskName}".\nВремя старта: ${startDate}\nВремя окончания: ${endDate}\nВремя выполнения: ${formatted}`
      );
    });

    // логирование ошибок
    this.bot.on("polling_error", console.log);
  }

  async startTrack(msg) {
    const userId = msg.from.id;

    const taskName = await this.sendMessageWithReply(
      "Название задачи: ",
      userId
    );

    const startDate = format(Date.now(), "HH:mm:ss yyyy-MM-dd");

    if (!this.config.data[userId]) {
      this.config.data[userId] = {};
    }

    const taskId = uuidv4();
    this.config.data[userId][taskId] = {
      id: taskId,
      name: taskName,
      start: startDate,
    };

    this.saveToFile();
    this.saveToDisk(userId);

    this.bot.sendMessage(
      userId,
      `Начало задачи "${taskName}"\nВремя: ${startDate}`
    );

    return this.showMainMenu(userId);
  }

  stopTrack(msg) {
    console.log(msg);
    const userId = msg.from.id;
    console.log(userId);

    const unendedTasks = Object.values(this.config.data[userId] || {}).filter(
      (taskInfo) => !taskInfo.end
    );
    const unendedTaskNames = unendedTasks.map((task) => task.name);
    const inlineKeyboard = unendedTaskNames.map((task) => [
      { text: task, callback_data: task },
    ]);
    inlineKeyboard.push([
      {
        text: "Назад",
        callback_data: "Назад",
      },
    ]);

    const options = {
      reply_markup: JSON.stringify({
        inline_keyboard: inlineKeyboard,
      }),
    };
    this.bot.sendMessage(
      userId,
      "Выбери задачу, которую нужно закончить",
      options
    );
  }

  async saveToDisk(userId) {
    const excelBuffer = await this.createExcelBuffer(userId);

    const blob = new Blob([excelBuffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const docName = "Mommy.xlsx";

    const data = await axios
      .get(`${YANDEXDISC_URL}?path=%2FMommy%2F${docName}&overwrite="true"`, {
        headers: {
          Authorization:
            // "OAuth y0_AgAAAAA9wUDsAAlL0AAAAADew7VHzQChqQWWRuSdja0mp-X7dBffo48",
            "OAuth y0_AgAAAAA9wUDsAAhXJgAAAADMvl-GW8tawsv5ToSoA2yOkFZyoGDRyOQ",
        },
      })
      .then((res) => res.data)
      .catch(console.log);

    if (!data) {
      return;
    }

    const href = data.href;

    axios
      .put(href, blob, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": blob.size,
        },
      })
      .catch(console.log);
  }

  async createExcelBuffer(userId) {
    const excelData = [["Задача", "Начало", "Конец", "Время выполнения"]];
    Object.values(this.config.data[userId] || {}).forEach((task) => {
      excelData.push([task.name, task.start, task.end || "", task.diff || ""]);
    });

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet("1");

    for (let row of excelData) {
      worksheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer({ base64: true });

    return buffer;
  }

  // сохраняем данные в переменную и в файл
  async saveToFile() {
    // сохраняем данные
    await new Promise((resolve, reject) =>
      fs.writeFile(CONFNAME, JSON.stringify(this.config, null, 2), (err) => {
        if (err) {
          reject(console.log(err));
        }
        resolve();
      })
    );
  }

  // отправляем сообщение и дожидаемся ответа
  async sendMessageWithReply(message, chatId) {
    return new Promise(async (resolve) => {
      const prompt = await this.bot.sendMessage(chatId, message, {
        reply_markup: {
          force_reply: true,
        },
      });

      this.bot.onReplyToMessage(chatId, prompt.message_id, async (msg) => {
        resolve(msg.text);
      });
    });
  }

  showMainMenu(id, start = false) {
    this.bot.sendMessage(id, start ? INFO : "Главное меню", {
      reply_markup: {
        keyboard: [
          [MAIN_MENU.INFO, MAIN_MENU.INSTRUCTIONS],
          [MAIN_MENU.START, MAIN_MENU.STOP],
          [MAIN_MENU.CURRENT_TASKS, MAIN_MENU.ALL_TASKS],
          [MAIN_MENU.DOWNLOAD],
        ],
      },
    });
  }
}

const boter = new Bot();
