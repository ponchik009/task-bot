export const CONFNAME = "./src/data/config.json";

export const INFO = `
Привет, я бот, который необходим, чтобы ты мог трекать своё ценное время
`;

export const INSTRUCTIONS = `
Инструкция по использованию:
1. Напиши /go (или нажми кнопку Старт) и в ответном сообщении название задачи
2. Когда закончишь задачу, напиши /end (или нажми кнопку Стоп) и выбери задачу, которую заканчиваешь
3. Perfecto! Время выполнения твоей задачи записано (наверное)

Если что-то багается, и ты хочешь вернуться в главное меню, просто напиши /start

`;

export const MAIN_MENU = {
  INFO: "Информация о проекте",
  INSTRUCTIONS: "Инструкция по использованию",
  START: "Старт",
  STOP: "Стоп",
  CURRENT_TASKS: "Текущие задачи",
  ALL_TASKS: "Все задачи",
  DOWNLOAD: "Выгрузка в excel",
};

export const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const YANDEXDISC_URL =
  "https://cloud-api.yandex.net/v1/disk/resources/upload";

export const TIME_ZONE = "Asia/Irkutsk";
