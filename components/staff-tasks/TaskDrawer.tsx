"use client";

import { useState, type ReactNode } from "react";
import { Link2, Loader2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Modal, { useModalClose } from "@/components/ui/Modal";
import {
  EVENT_LABEL,
  OPEN_STATUSES,
  isActive,
  isLateDone,
  type StaffTask,
  type StaffTaskBranch,
  type StaffTaskEmployee,
  type StaffTaskSettings,
} from "@/lib/staffTasks";
import DeadlineRail from "./DeadlineRail";
import TaskForm from "./TaskForm";
import { FileTags, NextStep, PriorityBadge, StatusChip, eventDetail } from "./bits";
import type { TaskActionKind } from "./ActionModal";
import type { StaffFmt } from "./format";

// O'NGDAN CHIQADIGAN PANEL — topshiriq tafsiloti va yaratish/tahrirlash
// formasi BITTA panelda (prototipdagi drawer). Panel ui/Modal `drawer`
// varianti: ochilish va yopilish animatsiyasi bilan. Tafsilot ↔ forma
// almashganda panel yopilmaydi — ichidagi mazmun yumshoq almashadi
// (`.stk-swap`), aks holda panel chiqib-kirib "sakrardi".

export type DrawerMode = { mode: "detail"; id: number } | { mode: "form"; id: number | null };

interface Props {
  state: DrawerMode;
  /** Ro'yxatdagi nusxa (tarixsiz) — batafsil kelguncha shu chiziladi. */
  listTask: StaffTask | null;
  /** Batafsil (tarix bilan); kelmagan bo'lsa `null`. */
  detail: StaffTask | null;
  detailError: string;
  branches: StaffTaskBranch[];
  employees: StaffTaskEmployee[];
  settings: StaffTaskSettings;
  nowMs: number;
  fmt: StaffFmt;
  onClose: () => void;
  onMode: (m: DrawerMode) => void;
  onAction: (task: StaffTask, kind: TaskActionKind) => void;
  onCreated: (tasks: StaffTask[]) => void;
  onUpdated: (task: StaffTask) => void;
}

export default function TaskDrawer({ state, listTask, detail, detailError, branches, employees, settings, nowMs, fmt, onClose, onMode, onAction, onCreated, onUpdated }: Props) {
  const { t, stamp, money } = fmt;
  const modal = useModalClose(onClose, "drawer");
  const [busy, setBusy] = useState(false);
  const branchName = (id: number) => branches.find((b) => b.id === id)?.name ?? "";
  const task = detail ?? listTask;

  let content: ReactNode = null;
  if (state.mode === "form") {
    content = (
      <TaskForm
        task={state.id === null ? null : task}
        employees={employees}
        branches={branches}
        settings={settings}
        nowMs={nowMs}
        fmt={fmt}
        onBusy={setBusy}
        onCancel={() => (state.id === null ? modal.close() : onMode({ mode: "detail", id: state.id }))}
        onCreated={(tasks) => {
          onCreated(tasks);
          modal.close();
        }}
        onUpdated={(updated) => {
          onUpdated(updated);
          onMode({ mode: "detail", id: updated.id });
        }}
      />
    );
  } else if (!task) {
    content = (
      <>
        <div className="stk-dhead">
          <div className="stk-dhl" />
          <button type="button" className="stk-dx" onClick={modal.close} aria-label={t("Yopish")}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="stk-dbody text-sm text-muted-foreground">
          {detailError ? t(detailError) : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      </>
    );
  } else {
    const mine = task.isMine;
    const manage = task.canManage;
    const late = isLateDone(task);
    const history = detail?.history ? [...detail.history].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)) : null;
    const fine = task.fine;
    content = (
      <>
        <div className="stk-dhead">
          <div className="stk-dhl">
            <StatusChip status={task.status} fmt={fmt} />
            {late && <span className="stk-late">{t("kechikib bajarildi")}</span>}
            <h2>{task.title}</h2>
            <div className="stk-dsub">
              {!mine && `${task.employeeName}, ${branchName(task.branchId)}. `}
              {t("Berdi: {name}, {stamp}", { name: task.createdByName || "—", stamp: stamp(task.createdAt, nowMs) })}
            </div>
          </div>
          <button type="button" className="stk-dx" onClick={modal.close} aria-label={t("Yopish")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="stk-dbody">
          <NextStep task={task} manager={manage} nowMs={nowMs} fmt={fmt} graceHours={settings.graceHours} />

          <div className="stk-sec" style={{ marginTop: 0 }}>
            <h4>{t("Muddat chizig'i")}</h4>
            <DeadlineRail task={detail ?? task} nowMs={nowMs} fmt={fmt} graceHours={settings.graceHours} />
          </div>

          {task.desc && (
            <div className="stk-sec">
              <h4>{t("Nima qilish kerak")}</h4>
              <div className="stk-desc">{task.desc}</div>
            </div>
          )}

          {(task.attachments.length > 0 || task.link) && (
            <div className="stk-sec">
              <h4>{t("Biriktirmalar")}</h4>
              <FileTags taskId={task.id} files={task.attachments} kind="att" />
              {task.link && (
                <div className="mt-1.5" style={{ overflowWrap: "anywhere" }}>
                  <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={task.link} target="_blank" rel="noopener noreferrer">
                    <Link2 className="h-3.5 w-3.5 shrink-0" />
                    {task.link}
                  </a>
                </div>
              )}
            </div>
          )}

          {task.doneAt && (
            <div className="stk-sec">
              <h4>{t("Xodim natijasi")}</h4>
              <div className="stk-result">
                {task.doneNote ? task.doneNote : <span className="text-muted-foreground">{t("izohsiz")}</span>}
                {task.resultLink && (
                  <div className="mt-1.5">
                    <a className="inline-flex items-center gap-1.5 text-primary hover:underline" href={task.resultLink} target="_blank" rel="noopener noreferrer">
                      <Link2 className="h-3.5 w-3.5 shrink-0" />
                      {task.resultLink}
                    </a>
                  </div>
                )}
                {task.resultFile && (
                  <div className="mt-1.5">
                    <FileTags taskId={task.id} files={[task.resultFile]} kind="res" />
                  </div>
                )}
                <small>
                  {t("Bajardim: {stamp}", { stamp: stamp(task.doneAt, nowMs) })}
                  {task.isLate ? ` ${t("(kechikib)")}` : ""}
                </small>
              </div>
            </div>
          )}

          {task.status === "bajarilmadi" && fine && (
            <div className="stk-sec">
              <h4>{t("Jarima")}</h4>
              <div className="stk-fine-box">
                <b>{money(fine.amount)}</b> — {t("{month} oyligidan ushlanadi.", { month: fmt.monthLabel(fine.month) })}{" "}
                {fine.status === "bekor"
                  ? t("Bekor qilingan: {reason} ({by}, {at}).", { reason: fine.cancelReason, by: fine.cancelledBy, at: stamp(fine.cancelledAt, nowMs) })
                  : fine.held < fine.amount
                    ? t("Oylik limitdan oshdi — ushlanadi: {held}.", { held: money(fine.held) })
                    : t("Kuchda.")}
              </div>
            </div>
          )}

          {task.status === "bekor" && (
            <div className="stk-sec">
              <h4>{t("Bekor qilish sababi")}</h4>
              <div className="stk-result">{task.cancelReason}</div>
            </div>
          )}

          <div className="stk-sec">
            <h4>{t("Ma'lumot")}</h4>
            <div className="stk-kv">
              <div>{t("Muhimlik")}</div>
              <div>
                <PriorityBadge p={task.priority} fmt={fmt} />{" "}
                <span className="text-muted-foreground">{t("bajarilmasa {fine}", { fine: money(task.fineAmount) })}</span>
              </div>
              <div>{t("Ko'rildi")}</div>
              <div>{task.seenAt ? stamp(task.seenAt, nowMs) : <span className="text-muted-foreground">{t("hali ochilmagan")}</span>}</div>
              {task.batchSize > 1 && (
                <>
                  <div>{t("Guruhli")}</div>
                  <div>{t("{n} xodimga alohida nusxa", { n: task.batchSize })}</div>
                </>
              )}
              {task.returnCount > 0 && (
                <>
                  <div>{t("Qaytarishlar")}</div>
                  <div>{t("{n} marta", { n: task.returnCount })}</div>
                </>
              )}
            </div>
          </div>

          <div className="stk-sec">
            <h4>{t("Tarix")}</h4>
            {history === null ? (
              detailError ? (
                <div className="text-[13px] text-muted-foreground">{t(detailError)}</div>
              ) : (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )
            ) : (
              <ul className="stk-hist">
                {history.map((e, i) => {
                  const d = eventDetail(e, fmt, nowMs);
                  return (
                    <li key={`${e.at}-${i}`}>
                      <time>{stamp(e.at, nowMs)}</time>
                      <div>
                        <b>{t(EVENT_LABEL[e.kind] ?? e.kind)}</b> <span className="text-muted-foreground">{e.by || t("Tizim")}</span>
                        {d && <small>{d}</small>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {(() => {
          const buttons: ReactNode[] = [];
          if (mine && isActive(task.status)) {
            buttons.push(
              <Button key="done" variant="primary" onClick={() => onAction(task, "done")}>
                {t("Bajardim")}
              </Button>,
              <span key="hint" className="stk-hint">{t("Rahbar tasdiqlagach yakunlanadi")}</span>,
            );
          } else if (mine && task.status === "tasdiq_kutilmoqda") {
            buttons.push(<span key="hint" className="stk-hint">{t("Rahbar tasdig'i kutilmoqda")}</span>);
          }
          if (manage) {
            if (task.status === "tasdiq_kutilmoqda") {
              buttons.push(
                <Button key="ok" variant="outline" className="stk-btn-ok" onClick={() => onAction(task, "approve")}>
                  {t("Tasdiqlash")}
                </Button>,
                <Button key="ret" variant="outline" className="stk-btn-warn" onClick={() => onAction(task, "return")}>
                  {t("Qaytarish")}
                </Button>,
              );
            }
            if (isActive(task.status)) {
              buttons.push(
                <Button key="edit" variant="outline" onClick={() => onMode({ mode: "form", id: task.id })}>
                  {t("Tahrirlash")}
                </Button>,
              );
            }
            if (OPEN_STATUSES.includes(task.status)) {
              buttons.push(
                <Button key="cancel" variant="outline" className="stk-btn-bad" onClick={() => onAction(task, "cancel")}>
                  {t("Bekor qilish")}
                </Button>,
              );
            }
          }
          return buttons.length ? <div className="stk-dfoot">{buttons}</div> : null;
        })()}
      </>
    );
  }

  return (
    <Modal controller={modal} onClose={onClose} variant="drawer" size="xl" bare locked={busy}>
      <div key={`${state.mode}-${state.id ?? "new"}`} className="stk-swap">
        {content}
      </div>
    </Modal>
  );
}
