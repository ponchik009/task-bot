import axios from "axios";
import fs from "fs";
import TelegramBotApi from "node-telegram-bot-api";
import Excel from "exceljs";

import {
  CONFNAME,
  INFO,
  INSTRUCTIONS,
  MAIN_MENU,
  YANDEXDISC_URL,
} from "./const.js";
import { format, formatDuration, intervalToDuration } from "date-fns";

// encodeURIComponent("https://disk.yandex.ru/i/TTkPbOZDQwyVdQ")

class Bot {
  constructor() {
    this.config = JSON.parse(fs.readFileSync(CONFNAME));

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
      const tasksAnswer = Object.values(this.config.data)
        .filter((task) => !task.end)
        .map((task) => `\nЗадача: ${task.name}\nВремя начала: ${task.start}`)
        .join("\n");
      const answer = `Текущие задачи:\n` + tasksAnswer;
      return this.bot.sendMessage(msg.from.id, answer);
    });

    // все таски
    this.bot.onText(new RegExp(MAIN_MENU.ALL_TASKS), (msg) => {
      const tasksAnswer = Object.values(this.config.data)
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
      return this.bot.sendMessage(msg.from.id, answer);
    });

    this.bot.on("callback_query", async (callbackQuery) => {
      const action = callbackQuery.data;
      const msg = callbackQuery.message;

      if (action === "Назад") {
        return this.showMainMenu(msg.chat.id);
      }

      const taskName = action;
      const startDate = this.config.data[taskName].start;
      const endDate = format(Date.now(), "HH:mm:ss yyyy-MM-dd");

      this.config.data[taskName].end = endDate;

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

      console.log(formatted);

      this.config.data[taskName].diff = formatted;

      this.saveToFile();
      this.saveToDisk();

      return this.bot.sendMessage(
        msg.chat.id,
        `Задача "${taskName}".\nВремя старта: ${startDate}\nВремя окончания: ${endDate}\nВремя выполнения: ${formatted}`
      );
    });

    // логирование ошибок
    this.bot.on("polling_error", console.log);
  }

  async startTrack(msg) {
    const taskName = await this.sendMessageWithReply(
      "Название задачи: ",
      msg.from.id
    );
    const startDate = format(Date.now(), "HH:mm:ss yyyy-MM-dd");

    this.config.data[taskName] = {
      name: taskName,
      start: startDate,
    };

    this.saveToFile();
    this.saveToDisk();

    this.bot.sendMessage(
      msg.from.id,
      `Начало задачи "${taskName}". Время: ${startDate}`
    );

    return this.showMainMenu(msg.from.id);
  }

  stopTrack(msg) {
    const unendedTasks = Object.entries(this.config.data).filter(
      ([taskName, taskInfo]) => !taskInfo.end
    );
    const unendedTaskNames = unendedTasks.map((entry) => entry[0]);
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
      msg.chat.id,
      "Выбери задачу, которую нужно закончить",
      options
    );
  }

  async saveToDisk() {
    const excelData = [["Задача", "Начало", "Конец", "Время выполнения"]];
    Object.values(this.config.data).forEach((task) => {
      excelData.push([task.name, task.start, task.end || "", task.diff || ""]);
    });

    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet("1");

    for (let row of excelData) {
      worksheet.addRow(row);
    }

    const buffer = await workbook.xlsx.writeBuffer({ base64: true });
    const blob = new Blob([buffer], {
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

  // сохраняем данные в переменную и в файл
  async saveToFile() {
    // сохраняем данные
    await new Promise((resolve, reject) =>
      fs.writeFile(CONFNAME, JSON.stringify(this.config), (err) => {
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
          [MAIN_MENU.CURRENT_TASKS],
          [MAIN_MENU.ALL_TASKS],
        ],
      },
    });
  }
}

const boter = new Bot();
