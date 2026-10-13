# messenger-tracker

**Which messenger button was clicked, where on the page, and on which page.**
A tiny dependency-free script (4 KB minified, 2 KB gzip) that sends every click on a WhatsApp, Telegram, MAX, Yandex Messenger, VK or Viber link to Yandex Metrica, GA4 and GTM, with the place of the button attached.

По-русски: сайт с кнопками «Написать в WhatsApp / Telegram / MAX» обычно видит в Метрике только «был переход в WhatsApp». Какая кнопка сработала (шапка, подвал, плавающий виджет, блок цен) и на какой странице, не видно: у всех кнопок один и тот же адрес. Скрипт добавляет к каждому клику место и страницу.

## Что получается в Метрике

- Цель `messenger_click` на любой клик по мессенджеру.
- Цель на каждое место: `messenger_footer`, `messenger_widget`, `messenger_header` и т.д. (шаблон задаёте сами).
- Параметры визита деревом: `messenger_click → whatsapp → widget → /stranica.html`. Отчёт «Параметры визитов» раскрывается по уровням: мессенджер, место, страница.

В GA4 уходит событие `messenger_click` с полями `messenger`, `place`, `link_id`, `page_path`; в `dataLayer` (GTM) событие `messenger_click` с `mt_messenger`, `mt_place`, `mt_id`, `mt_page`.

## Подключение

1. Положите `messenger-tracker.js` на сайт и подключите после кода счётчика (или в любом месте, порядок не важен):

```html
<script src="/js/messenger-tracker.js" data-ym="12345678"
        data-goals="messenger_click,messenger_%place%" defer></script>
```

Или прямо с CDN (jsDelivr, версия зафиксирована тегом, `.min.js` jsDelivr сжимает сам):

```html
<script src="https://cdn.jsdelivr.net/gh/trendbender/messenger-tracker@1.0.0/messenger-tracker.min.js"
        data-ym="12345678" data-goals="messenger_click,messenger_%place%" defer></script>
```

2. Отметьте места. Атрибут ставится на саму ссылку или на любой блок вокруг неё:

```html
<footer>
  <div class="social" data-mt-place="footer">
    <a href="https://wa.me/79990000000">WhatsApp</a>
    <a href="https://t.me/username">Telegram</a>
  </div>
</footer>
<a class="chat-widget" data-mt-place="widget" href="https://wa.me/79990000000">Задайте вопрос</a>
```

3. Создайте в Метрике цели типа «JavaScript-событие» с идентификаторами `messenger_click`, `messenger_footer`, `messenger_widget` (по одной на каждое место).

Без разметки скрипт тоже работает: место определяется по `header`, `footer`, `nav`, `aside`, `main/article` (`content`), иначе `other`.

## Настройки

Через атрибуты тега `<script>` (без фигурных скобок, поэтому безопасно в шаблонах MODX/Fenom, Smarty, Twig, Blade):

| Атрибут | Что делает |
|---|---|
| `data-ym` | номер счётчика Метрики |
| `data-goals` | цели через запятую, `%place%`, `%messenger%`, `%id%` подставляются |
| `data-debug` | печатать каждый клик в консоль (или `?mt_debug=1` в адресе) |

Или объектом до подключения скрипта:

```html
<script>
window.MessengerTrackerConfig = {
  ym: 12345678,
  goals: ['messenger_click', 'messenger_{place}'],
  places: [['.chat-widget', 'widget'], ['.price-table', 'prices']], // места по CSS-селектору, без правки разметки
  paramsKey: 'messenger_click',  // корень дерева параметров визита
  gtag: true, dataLayer: true,   // false, чтобы отключить
  whatsappText: '',              // необязательно: предзаполненный текст wa.me, напр. 'Здравствуйте! (%id%)'
  telegramStart: '',             // необязательно: ?start= для Telegram-ботов, напр. 'site_%place%'
  messengers: [['viber_web', /viber\.com\/chat/i]]  // свои мессенджеры
};
</script>
```

На ссылке можно задать `data-mt-id="hero_cta"` (свой идентификатор кнопки) и `data-mt-messenger="whatsapp"` (если адрес не распознаётся).

## Как это устроено и почему так

- **Счётчик скрипт не загружает.** Если Метрики на странице нет (например, посетитель отказался от cookie), в Метрику ничего не уходит. Согласие на cookie остаётся за сайтом.
- **Страница без query string:** в параметры попадает только путь, чтобы не утекли персональные данные из адреса.
- **Ссылки в той же вкладке** (без `target="_blank"`): переход ждёт отправки цели, но не дольше 300 мс.
- **Средняя кнопка мыши** тоже считается, правая нет.
- **Предзаполненный текст и `?start=` выключены по умолчанию.** Telegram передаёт `start` только ботам, у личных аккаунтов параметр теряется. Текст в WhatsApp пациент видит и может стереть, а в деликатных темах (медицина, юристы) код в первом сообщении отпугивает. Включайте, только если менеджеру нужно видеть источник прямо в чате.
- Работает вместе с целями «переход по ссылке» и автоцелью «Переходы в мессенджеры»: те считают мессенджер, этот скрипт добавляет место.

## Проверка на своём сайте

В консоли браузера:

```js
MessengerTracker.scan()   // все ссылки в мессенджеры на странице: мессенджер, место, id
```

Свой код может слушать событие: `document.addEventListener('messenger-tracker:click', e => console.log(e.detail))`.

## Тесты

`test/index.html` в браузере или без окна:

```bash
bash test/run.sh
```

## Где используется

Первое внедрение: сайт частной медицинской практики на MODX Revolution (подвал с четырьмя мессенджерами и плавающий виджет «Задайте вопрос»), настройка атрибутами прямо в чанке Fenom. Сделано в [КлиентЛаб](https://klientlab.ru/tools/messenger-tracker/).

## Лицензия

MIT
