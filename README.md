# messenger-tracker

**Which messenger button was clicked, where on the page, and on which page.**
A tiny dependency-free script (6 KB minified, 3 KB gzip) that sends every click on a WhatsApp, Telegram, MAX, Yandex Messenger, VK or Viber link to Yandex Metrica, GA4 and GTM, with the place of the button attached.

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
<script src="https://cdn.jsdelivr.net/gh/trendbender/messenger-tracker@1.4.1/messenger-tracker.min.js"
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

## GA4 через Google Tag Manager

Если GA4 стоит через GTM (`window.gtag` на странице нет), скрипт кладёт каждый клик в `dataLayer`:

```js
{ event: 'messenger_click', mt_messenger: 'whatsapp', mt_place: 'cta', mt_id: 'whatsapp_cta', mt_page: '/uslugi/' }
```

В GTM:
1. Переменные типа «Переменная уровня данных»: `mt_messenger`, `mt_place`, `mt_id`, `mt_page`.
2. Триггер «Пользовательское событие» с именем `messenger_click`.
3. Тег «Google Analytics: событие GA4», имя события `messenger_click`, параметры `messenger`, `place`, `link_id`, `page_path` из переменных выше, триггер из п. 2.
4. В GA4: Администратор, Специальные определения, параметры события `messenger` и `place` как специальные параметры (уровень события), чтобы видеть их в отчётах.

Если GA4 стоит кодом gtag.js (`window.gtag` есть), событие `messenger_click` с теми же параметрами уходит напрямую, GTM не нужен.

## Настройки

Через атрибуты тега `<script>` (без фигурных скобок, поэтому безопасно в шаблонах MODX/Fenom, Smarty, Twig, Blade):

| Атрибут | Что делает |
|---|---|
| `data-ym` | номер счётчика Метрики |
| `data-goals` | цели через запятую, `%place%`, `%messenger%`, `%id%` подставляются |
| `data-debug` | печатать каждый клик в консоль |
| `data-lang` | язык плашки режима проверки: `ru` или `en` (по умолчанию по `<html lang>`, в адресе можно `&mt_lang=en`) |

Или объектом до подключения скрипта:

```html
<script>
window.MessengerTrackerConfig = {
  ym: 12345678,
  goals: ['messenger_click', 'messenger_{place}'],
  places: [['.chat-widget', 'widget'], ['.price-table', 'prices']], // места по CSS-селектору, без правки разметки
  paramsKey: 'messenger_click',  // корень дерева параметров визита
  gtag: true, dataLayer: true,   // false, чтобы отключить
  waitCounter: 5000,             // мс: ждать счётчик, если он ещё не загружен (GTM грузит Метрику по первому действию)
  waitNavigate: 1000,            // мс: сколько ссылка в той же вкладке ждёт опоздавший счётчик
  whatsappText: '',              // необязательно: предзаполненный текст wa.me, напр. 'Здравствуйте! (код %cid%)'
  telegramStart: '',             // необязательно: ?start= для Telegram-ботов, напр. 'site_%place%_%cid%'
  messengers: [['viber_web', /viber\.com\/chat/i]]  // свои мессенджеры
};
</script>
```

На ссылке можно задать `data-mt-id="hero_cta"` (свой идентификатор кнопки) и `data-mt-messenger="whatsapp"` (если адрес не распознаётся).

## Как это устроено и почему так

- **Счётчик скрипт не загружает.** Если Метрики на странице нет (например, посетитель отказался от cookie), в Метрику ничего не уходит. Согласие на cookie остаётся за сайтом.
- **Страница без query string:** в параметры попадает только путь, чтобы не утекли персональные данные из адреса.
- **Счётчик появился позже клика** (GTM грузит Метрику только по первому действию посетителя, баннер согласия): скрипт ждёт `ym` и отправляет цель, как только он появится: до 5 секунд для ссылок в новой вкладке, до 1 секунды для ссылок в той же вкладке (переход придерживается). Не появился, значит не отправляет.
- **Ссылки в той же вкладке** (без `target="_blank"`): переход ждёт отправки цели, но не дольше 300 мс (если счётчик ещё не загружен, плюс до 1 секунды на его появление).
- **Средняя кнопка мыши** тоже считается, правая нет.
- **Предзаполненный текст и `?start=` выключены по умолчанию.** Telegram передаёт `start` только ботам, у личных аккаунтов параметр теряется. Текст в WhatsApp пациент видит и может стереть, а в деликатных темах (медицина, юристы) код в первом сообщении отпугивает. Включайте, только если менеджеру нужно видеть источник прямо в чате.
- **ClientID Метрики в тексте (`%cid%`, с 1.4.1)** связывает переписку с визитом: менеджер копирует код из первого сообщения, а сделку потом можно загрузить в Метрику офлайн-конверсией по ClientID. Код берётся из `ym(id, 'getClientID')`, а пока счётчик не ответил, из куки `_ym_uid`. Если кода ещё нет (первый визит, клик до загрузки Метрики), скобка с ним убирается целиком: `'Здравствуйте! (код %cid%)'` превращается в `'Здравствуйте!'`. Текст подставляется заново на каждом клике, поэтому работает и для ссылок, появившихся после загрузки страницы (SPA).
- Работает вместе с целями «переход по ссылке» и автоцелью «Переходы в мессенджеры»: те считают мессенджер, этот скрипт добавляет место.

## Проверка на своём сайте

Откройте любую страницу с `?mt_debug=1` в адресе (например `https://site.ru/kontakty/?mt_debug=1`) и нажмите кнопки мессенджеров. В режиме проверки ссылки не открываются, а внизу слева на каждый клик всплывает плашка: мессенджер, место, страница и статус отправки, вплоть до «✓ Метрика 12345678 приняла: messenger_click, messenger_footer». Если счётчика нет (например, не дано согласие на cookie), плашка так и скажет. Отдельными строками плашка показывает, что ушло в GA4 (gtag) и в `dataLayer` для GTM. Язык плашки: `&mt_lang=en` или `&mt_lang=ru`. Клики в этом режиме настоящие и попадают в Метрику: удобно для приёмки, записи видео и показа клиенту.

В консоли браузера:

```js
MessengerTracker.scan()   // все ссылки в мессенджеры на странице: мессенджер, место, id
```

Свой код может слушать событие: `document.addEventListener('messenger-tracker:click', e => console.log(e.detail))`.

## Тесты

`test/index.html` и `test/check.html?mt_debug=1` в браузере или без окна:

```bash
bash test/run.sh
```

## Где используется

Первое внедрение: сайт частной медицинской практики на MODX Revolution (подвал с четырьмя мессенджерами и плавающий виджет «Задайте вопрос»), настройка атрибутами прямо в чанке Fenom. Сделано в [КлиентЛаб](https://klientlab.ru/tools/messenger-tracker/).

## Лицензия

MIT
