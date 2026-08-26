# akademiya.edutizim.uz — sidebar manzillari

Sidebar flyoutlaridan olingan (sintetik `pointerover`/`mouseenter` bilan; sichqoncha
koordinatalari kerak emas). Chap ustun — bizdagi mos sahifa.

MUHIM: to'g'ridan-to'g'ri URL kiritib ochganda ba'zi sahifalar bo'sh qobiq
qaytaradi. Ishonchli yo'l — shu manzilga navigatsiya qilish; SPA o'zi kerakli
parametrlarni qo'shadi (masalan `?limit=50&page=1&sortBy=...`).

| Referens | Bizda |
|---|---|
| **Topshiriqlar** | |
| `/tasks/list` | `/tasks` |
| **Lidlar** | |
| `/orders/order-list/table` | `/orders-list` |
| `/orders/order-list/kanban` | `/orders-list?layout=kanban` |
| `/orders/come-orders` | `/first-lessons` |
| **Guruh** | |
| `/group/groups` | `/groups` |
| `/group/tasks` | `/groups-tasks` |
| `/group/class-schedule` | `/groups-schedule` |
| `/group/rooms` | `/groups-rooms` |
| `/group/equipments` | `/groups-equipments` |
| `/group/group-students` | `/groups-students` |
| **O'quvchilar** | |
| `/orders/new-student-list` | `/new-students` |
| `/students/active` | `/active-students` |
| `/students/archive` | `/archive-students` |
| `/students/student-list` | `/students-list` |
| `/students/parent` | `/parents` |
| `/students/debt-risk` | `/expiring-subs` |
| `/students/locations` | `/student-addresses` |
| **O'quv bo'limi** | |
| `/course/courses` | `/offline-courses` |
| `/online-course` | `/online-courses` |
| `/online-course-category` | `/edu-category` |
| `/seasonal-assessment` | `/seasonal-assessment` |
| `/course/contracts` | `/contract` |
| **Blok test** | |
| `/block-test/types` | `/blok-test-turlari` |
| `/block-test/exams` | `/blok-testlar` |
| **Moliya** | |
| `/finance/cash` | `/finance-cash` |
| `/finance/bonus` | `/finance-bonus` |
| `/finance/penalty` | `/finance-penalty` |
| `/finance/salary` | `/finance-payroll` (hisob-kitob; tarix — `/finance-payroll/history`) |
| `/analytics/finance` | `/finance-cashflow` |
| `/analytics/income-plan` | `/finance-revenue-plan` |
| `/analytics/financial-analytics` | `/finance-analytics` |
| `/analytics/financial-reports` | `/finance-reports` |
| `/finance/pnl-reports` | `/finance-pnl` |
| `/finance/cashflow` | `/finance-flow` |
| `/finance/payment-type` | `/finance-tx-types` |
| `/finance/transactions` | `/finance-transactions` |
| `/finance/planned-expense` | `/finance-planned` |
| `/finance/contract` | `/finance-fin-contract` |
| **Nazorat** | |
| `/students/attendance` | `/nazorat-davomat` |
| `/analytics/attendance` | `/nazorat-davomat-analytics` |
| `/feedback` | `/nazorat-feedback` |
| `/hr/employees/ratings` | `/nazorat-staff-rating` |
| `/analytics/not-attended` | `/nazorat-missed-groups` |
| `/monitoring/statistics` | `/nazorat-branches` |
| `/analytics/turnstile` | `/nazorat-turnstile` |
| `/analytics/turnstile-enter-exit` | `/nazorat-turnstile-io` |
| `/nazorat/support-analytics` | `/nazorat-support-analytics` |
| **Boshqaruv** | |
| `/hr/employees` | `/management-xodimlar` |
| `/hr/roles` | `/management-rollar` |
| `/branches` | `/management-filiallar` |
| `/hr/work-schedules` | `/management-ish-jadvali` |
| **Sotuv va marketing** | |
| `/marketing/surveys` | `/sales-marketing` |
| `/marketing/sales-plan` | `/sales-plan` |
| `/news/news-list` | `/sales-news` |
| `/story/pagin` | `/sales-stories` |
| `/news/sms-template` | `/sales-sms` |
| `/news/sms` | `/sales-messages` |
| **Hisobotlar** | |
| `/analytics/order` | `/reports-funnel` |
| `/reports/finance/balance` | `/reports-balance` |
| `/reports/analytics/finance` | `/finance-cashflow` |
| `/reports/analytics/income-plan` | `/finance-revenue-plan` |
| `/reports/analytics/unpaid` | `/reports-unpaid` |
| `/reports/analytics/different` | `/reports-diff-payments` |
| `/analytics/cancelled-transactions` | `/reports-cancelled` |
| `/analytics/general-discounts` | `/reports-discounts` |
| `/analytics/teacher` | `/reports-teachers-perf` |
| `/analytics/moderator/student` | `/reports-admins-perf` |
| `/statistics` | `/reports-leave-reasons` |
| `/analytics/rooms` | `/reports-rooms` |
| `/analytics/earned-analytics` | `/reports-served` |
| `/analytics/attendance-cancelled-analytics` | `/reports-cancelled-attend` |
| `/reports/monitoring/statistics` | `/nazorat-branches` |
| `/reports/hr/employees/ratings` | `/nazorat-staff-rating` |
| `/reports/analytics/not-attended` | `/nazorat-missed-groups` |
| **Boshqa** | |
| `/home` | `/groups-schedule` (referensning BOSH sahifasi) |
| Sozlamalar | to'g'ridan-to'g'ri havola, flyout yo'q |

## Manzillarni qanday oldim

Referens tabi render bo'lmaganda (`window.innerWidth === 0`) sichqoncha
koordinatalari ishlamaydi. Yechim — MUI flyoutini sintetik hodisalar bilan ochish:

```js
for (const t of ['pointerover','pointerenter','mouseover','mouseenter'])
  el.dispatchEvent(new MouseEvent(t, {bubbles:true, cancelable:true, view:window}));
```

Yopilgan menyular DOM'da qolib ketadi, shuning uchun har bir bo'lim uchun
hoverdan OLDIN va KEYIN anchor to'plamini olib, FARQINI hisoblash kerak —
aks holda ro'yxatlar aralashib ketadi.
