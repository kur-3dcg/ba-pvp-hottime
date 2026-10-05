import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Shield,
  Clock3,
  Upload,
  Plus,
  Search,
  Download,
  RefreshCw,
  ChevronRight,
  X,
  Pencil,
  Trash2,
  ImagePlus,
  Users,
  ArrowDownToLine,
  Check,
  LoaderCircle,
  CircleHelp,
  HardDrive,
  SlidersHorizontal,
} from "lucide-react";
import { Chart } from "./Chart";
import { TIME_SOURCE_LABELS } from "./metadata";
import { initialCatalog, matchesStudent, refreshCatalog } from "./catalog";
import {
  DEFAULT_REGION,
  Scanner,
  type Candidate,
  type Region,
  type ScanResult,
} from "./ocr";
import {
  COLORS,
  elapsedLabel,
  fmt,
  fromInput,
  hotTime,
  inputDate,
  loadStore,
  manualElapsed,
  mergeStores,
  mergePlayers,
  normalize,
  saveStore,
  uid,
  validateStore,
  type Player,
  type RecordEntry,
  type Store,
  type Student,
} from "./model";

const NoticeContext = createContext("");
function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const notice = useContext(NoticeContext);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="閉じる" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
      {notice && (
        <div className="modal-notice" role="alert">
          {notice}
        </div>
      )}
    </dialog>
  );
}
function Avatar({ student, size = 38 }: { student?: Student; size?: number }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [student?.image]);
  return (
    <span className="avatar" style={{ width: size, height: size }}>
      {student && !failed ? (
        <img
          src={student.image}
          loading="lazy"
          referrerPolicy="no-referrer"
          alt={student.name}
          onError={() => setFailed(true)}
        />
      ) : (
        <Users size={size * 0.45} />
      )}
    </span>
  );
}
function IconPicker({
  items,
  value,
  onPick,
  onClose,
}: {
  items: Student[];
  value: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  return (
    <Modal title="顔アイコンを選ぶ" onClose={onClose} wide>
      <p className="muted">生徒名・よみ・各言語の名前で検索できます。</p>
      <label className="search-box">
        <Search size={17} />
        <input
          autoFocus
          placeholder="例：ヒナ、ひな、Hina"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </label>
      <div className="icon-grid">
        <button
          className={value === null ? "selected" : ""}
          onClick={() => onPick(null)}
        >
          <Avatar />
          <span>未設定</span>
        </button>
        {items
          .filter((s) => matchesStudent(s, q))
          .map((s) => (
            <button
              key={s.id}
              title={s.name}
              className={value === s.id ? "selected" : ""}
              onClick={() => onPick(s.id)}
            >
              <Avatar student={s} size={52} />
              <span>{s.name}</span>
            </button>
          ))}
      </div>
    </Modal>
  );
}

export default function App() {
  const [loaded] = useState(loadStore);
  const [store, setStore] = useState(loaded.store);
  const [catalog, setCatalog] = useState(initialCatalog);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [manualPlayer, setManualPlayer] = useState("");
  const [name, setName] = useState("");
  const [iconId, setIconId] = useState<string | null>(null);
  const [hours, setHours] = useState("0");
  const [minutes, setMinutes] = useState("0");
  const [pickFor, setPickFor] = useState<"manual" | "player" | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [listTab, setListTab] = useState<"players" | "records">("players");
  const [editPlayer, setEditPlayer] = useState<Player | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [editRecord, setEditRecord] = useState<RecordEntry | null>(null);
  const [editAt, setEditAt] = useState("");
  const [deleteRecord, setDeleteRecord] = useState<string | null>(null);
  const [deleteAllRecords, setDeleteAllRecords] = useState(false);
  const [deleteAllPlayers, setDeleteAllPlayers] = useState(false);
  const [page, setPage] = useState(1);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [batchTotal, setBatchTotal] = useState(0);
  const [batchSaved, setBatchSaved] = useState(0);
  const [autoReadNext, setAutoReadNext] = useState(false);
  const [preview, setPreview] = useState("");
  const [region, setRegion] = useState<Region>(() => {
    try {
      const value = JSON.parse(
        localStorage.getItem("ba-pvp-hottime.roi") || "null",
      );
      return value &&
        ["x", "y", "width", "height"].every((k) => Number.isFinite(value[k]))
        ? value
        : DEFAULT_REGION;
    } catch {
      return DEFAULT_REGION;
    }
  });
  const [adjust, setAdjust] = useState(false);
  const [progress, setProgress] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [rememberNames, setRememberNames] = useState(true);
  const [baseAt, setBaseAt] = useState("");
  const [drag, setDrag] = useState(false);
  const [help, setHelp] = useState(false);
  const [duplicateDefault, setDuplicateDefault] = useState(() => {
    try {
      return localStorage.getItem("ba-pvp-hottime.add-duplicates") === "true";
    } catch {
      return false;
    }
  });
  const [addDuplicates, setAddDuplicates] = useState(false);
  const [duplicateReview, setDuplicateReview] = useState<{
    next: Store;
    original: Store;
    ids: string[];
    done: (count: number) => void;
  } | null>(null);
  const [restore, setRestore] = useState<Store | null>(null);
  const scanner = useRef<Scanner | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const backupInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(id);
  }, [message]);
  useEffect(() => {
    if (!uploadFile) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(uploadFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [uploadFile]);
  useEffect(() => {
    if (uploadFile && autoReadNext && !progress) {
      setAutoReadNext(false);
      void runScan();
    }
  }, [uploadFile, autoReadNext, progress]);
  useEffect(() => {
    const fn = (e: StorageEvent) => {
      if (e.key === "ba-pvp-hottime.v1") {
        const next = loadStore();
        if (!next.error) setStore(next.store);
        else setMessage(next.error);
      }
    };
    window.addEventListener("storage", fn);
    return () => window.removeEventListener("storage", fn);
  }, []);
  const student = (id: string | null) => catalog.items.find((s) => s.id === id);
  function commit(next: Store) {
    if (loaded.error) {
      setMessage(loaded.error);
      return false;
    }
    try {
      saveStore(next);
      setStore(next);
      return true;
    } catch {
      setMessage(
        "保存できませんでした。空き容量やブラウザーの保存設定を確認してください。",
      );
      return false;
    }
  }
  function reviewRegistration(next: Store, done: (count: number) => void) {
    const seen = [...store.records];
    const ids: string[] = [];
    for (const r of next.records.filter(
      (r) => !store.records.some((old) => old.id === r.id),
    )) {
      if (
        seen.some(
          (old) =>
            (r.imageKey &&
              r.rowKey &&
              old.imageKey === r.imageKey &&
              old.rowKey === r.rowKey) ||
            (old.playerId === r.playerId &&
              Math.floor(old.at / 60000) === Math.floor(r.at / 60000)),
        )
      )
        ids.push(r.id);
      seen.push(r);
    }
    if (ids.length) {
      setAddDuplicates(duplicateDefault);
      setDuplicateReview({ next, original: store, ids, done });
    } else if (commit(next)) done(next.records.length - store.records.length);
  }
  function finishDuplicateReview() {
    if (!duplicateReview) return;
    const { next, original, ids, done } = duplicateReview;
    if (store !== original) {
      setDuplicateReview(null);
      setMessage("保存データが更新されました。もう一度登録してください。");
      return;
    }
    const records = addDuplicates
      ? next.records
      : next.records.filter((r) => !ids.includes(r.id));
    const players = next.players.filter(
      (p) =>
        original.players.some((old) => old.id === p.id) ||
        records.some((r) => r.playerId === p.id),
    );
    if (commit({ ...next, records, players })) {
      setDuplicateReview(null);
      done(records.length - original.records.length);
    }
  }
  function recordManual(e: React.FormEvent) {
    e.preventDefault();
    try {
      const elapsed = manualElapsed(Number(hours), Number(minutes));
      let p = store.players.find((p) => p.id === manualPlayer);
      let players = store.players;
      if (!p) {
        if (!name.trim()) throw Error("プレイヤー名を入力してください。");
        p = { id: uid(), name: name.trim(), iconId };
        players = [...players, p];
      }
      const base = Date.now();
      const r: RecordEntry = {
        id: uid(),
        playerId: p.id,
        at: base - elapsed.minutes * 60000,
        baseAt: base,
        elapsedMinutes: elapsed.minutes,
        precision: elapsed.precision,
        source: "manual",
      };
      reviewRegistration(
        { ...store, players, records: [...store.records, r] },
        (count) => {
          setMessage(
            count
              ? `${p.name}の防御を記録しました。`
              : "重複する記録は追加しませんでした。",
          );
          if (!count) return;
          setManualPlayer(p.id);
          setName("");
          setHours("0");
          setMinutes("0");
        },
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function chooseFiles(files: FileList | File[] | null) {
    const all = Array.from(files ?? []);
    if (!all.length) return;
    const accepted = all.filter(
      (file) =>
        ["image/png", "image/jpeg", "image/webp"].includes(file.type) &&
        file.size <= 30 * 1024 * 1024,
    );
    if (accepted.length !== all.length)
      setMessage(
        `${all.length - accepted.length}ファイルを除外しました。PNG・JPEG・WebP形式で、1枚30MB以内の画像を選んでください。`,
      );
    else setMessage("");
    if (!accepted.length) return;
    setUploadFile(accepted[0]);
    setUploadQueue(accepted.slice(1));
    setBatchTotal(accepted.length);
    setBatchSaved(0);
    setAutoReadNext(false);
    setScan(null);
    setAdjust(false);
  }
  function advanceFile(outcome: string, savedCount = 0) {
    const total = batchSaved + savedCount;
    setBatchSaved(total);
    setScan(null);
    setBaseAt("");
    setAdjust(false);
    if (uploadQueue.length) {
      setUploadFile(uploadQueue[0]);
      setUploadQueue(uploadQueue.slice(1));
      setAutoReadNext(true);
      setMessage(outcome);
    } else {
      setUploadFile(null);
      setUploadQueue([]);
      setAutoReadNext(false);
      setMessage(
        `${outcome}${batchTotal > 1 ? ` 今回の${batchTotal}枚から合計${total}件を保存しました。` : ""}`,
      );
    }
  }
  function closeUploads() {
    cancelScan();
    setAutoReadNext(false);
    setUploadQueue([]);
    setUploadFile(null);
    setScan(null);
  }
  async function runScan() {
    if (!uploadFile || progress) return;
    if (
      region.x < 0 ||
      region.y < 0 ||
      region.width < 10 ||
      region.height < 10 ||
      region.x + region.width > 100 ||
      region.y + region.height > 100
    ) {
      setMessage("読み取り範囲が画像内に収まるよう調整してください。");
      return;
    }
    setProgress("画像を準備中…");
    const instance = new Scanner();
    scanner.current = instance;
    try {
      const result = await instance.scan(uploadFile, region, (text) => {
        if (scanner.current === instance && !instance.cancelled)
          setProgress(text);
      });
      if (instance.cancelled || scanner.current !== instance) return;
      result.rows = result.rows.map((row) => {
        const corrected =
          store.corrections?.find((c) => c.from === row.rawName)?.to ??
          row.name;
        return {
          ...row,
          name: corrected,
          playerId: "__auto__",
        };
      });
      setScan(result);
      setBaseAt(inputDate(result.baseAt));
      try {
        localStorage.setItem("ba-pvp-hottime.roi", JSON.stringify(region));
      } catch {
        /* ROI persistence is optional */
      }
    } catch (e) {
      if (!instance.cancelled)
        setMessage((e as Error).message || "画像を読み取れませんでした。");
    } finally {
      if (scanner.current === instance) {
        scanner.current = null;
        setProgress("");
      }
    }
  }
  function cancelScan() {
    void scanner.current?.cancel();
    scanner.current = null;
    setProgress("");
  }
  function changeRow(id: string, changes: Partial<Candidate>) {
    setScan((prev) =>
      prev
        ? {
            ...prev,
            rows: prev.rows.map((r) =>
              r.id === id ? { ...r, ...changes } : r,
            ),
          }
        : prev,
    );
  }
  function saveScan() {
    if (!scan) return;
    try {
      const base =
        baseAt === inputDate(scan.baseAt) ? scan.baseAt : fromInput(baseAt);
      if (base > Date.now() + 60000)
        throw Error("基準時刻に未来の日時は指定できません。");
      const chosen = scan.rows.filter(
        (r) => r.selected && r.role === "defense",
      );
      if (!chosen.length) throw Error("保存する防御の行を選んでください。");
      let players = [...store.players];
      const records = [...store.records];
      let corrections = [...(store.corrections ?? [])];
      for (const row of chosen) {
        if (
          row.minutes === null ||
          !Number.isInteger(row.minutes) ||
          row.minutes < 0 ||
          row.minutes > 525600 ||
          (row.precision === "hour" && row.minutes % 60 !== 0) ||
          (row.precision === "day" && row.minutes % 1440 !== 0)
        )
          throw Error("経過時間を確認してください。");
        let p = players.find((p) => p.id === row.playerId);
        if (row.playerId === "__auto__")
          p = players.find(
            (candidate) => normalize(candidate.name) === normalize(row.name),
          );
        if (!p) {
          if (!row.name.trim()) throw Error("プレイヤー名を確認してください。");
          p = { id: uid(), name: row.name.trim(), iconId: null };
          players.push(p);
        }
        if (
          rememberNames &&
          row.rawName.trim() &&
          row.rawName.length <= 100 &&
          row.rawName !== "匿名" &&
          row.rawName !== p.name
        ) {
          corrections = [
            ...corrections.filter((c) => c.from !== row.rawName),
            { from: row.rawName, to: p.name },
          ];
        }
        records.push({
          id: uid(),
          playerId: p.id,
          baseAt: base,
          at: base - row.minutes * 60000,
          elapsedMinutes: row.minutes,
          precision: row.precision,
          source: "image",
          imageKey: scan.imageKey,
          rowKey: row.rowKey,
        });
      }
      reviewRegistration(
        { ...store, players, records, corrections },
        (count) => {
          advanceFile(
            `${count}件の防御を記録しました。${chosen.length > count ? ` 重複候補${chosen.length - count}件は追加しませんでした。` : ""}`,
            count,
          );
        },
      );
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function savePlayerEdit() {
    if (!editPlayer || !editPlayer.name.trim()) return;
    if (
      commit({
        ...store,
        players: store.players.map((p) =>
          p.id === editPlayer.id
            ? { ...editPlayer, name: editPlayer.name.trim() }
            : p,
        ),
      })
    ) {
      setEditPlayer(null);
      setMergeTargetId(null);
      setMessage("プレイヤーを更新しました。");
    }
  }
  function confirmPlayerMerge() {
    if (!editPlayer || !mergeTargetId) return;
    try {
      const next = mergePlayers(
        store,
        editPlayer.id,
        mergeTargetId,
        editPlayer.iconId,
      );
      if (commit(next)) {
        setSelected((ids) => [
          ...new Set(
            ids.map((id) => (id === editPlayer.id ? mergeTargetId : id)),
          ),
        ]);
        if (manualPlayer === editPlayer.id) setManualPlayer(mergeTargetId);
        setEditPlayer(null);
        setMergeTargetId(null);
        setMessage(
          "プレイヤーを統合しました。両方の防御記録を引き継ぎました。",
        );
      }
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function exportData() {
    const blob = new Blob(
      [JSON.stringify({ app: "ba-pvp-hottime", ...store }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ba-pvp-hottime-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024)
        throw Error("バックアップは20MB以内にしてください。");
      setRestore(validateStore(JSON.parse(await file.text())));
    } catch (e) {
      setMessage(`読み込めませんでした。${(e as Error).message}`);
    }
  }
  const filteredPlayers = store.players.filter(
    (p) =>
      normalize(p.name).includes(normalize(query)) ||
      (student(p.iconId) && matchesStudent(student(p.iconId)!, query)),
  );
  const visibleRecords = store.records
    .filter((r) =>
      r.playerId === ""
        ? normalize("プレイヤー未設定").includes(normalize(query))
        : filteredPlayers.some((p) => p.id === r.playerId),
    )
    .sort((a, b) => b.at - a.at);
  const dayCount = new Set(
    store.records.map((r) =>
      new Date(r.at + 9 * 3600000).toISOString().slice(0, 10),
    ),
  ).size;
  return (
    <NoticeContext.Provider value={message}>
      <header className="site-header">
        <a className="brand" href="/" aria-label="対抗戦ホットタイム ホーム">
          <span className="brand-icon">
            <Shield size={25} />
            <Clock3 className="brand-clock" size={13} />
          </span>
          <div>
            <strong>対抗戦ホットタイム</strong>
            <span>TACTICAL CHALLENGE · ACTIVITY LOG</span>
          </div>
        </a>
        <div className="header-actions">
          <span className="local-tag">
            <i />
            このブラウザーに保存
          </span>
          <button
            className="icon-button"
            aria-label="使い方"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={20} />
          </button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="eyebrow">YOUR DEFENSE RECORDS</div>
            <h1>相手の動きが、見えてくる。</h1>
            <p>防御履歴を記録して、攻撃が集まる時間帯をチェック。</p>
          </div>
          <div className="summary">
            <div>
              <span>防御の記録</span>
              <strong>
                {store.records.length}
                <small>件</small>
              </strong>
            </div>
            <div>
              <span>プレイヤー</span>
              <strong>
                {store.players.length}
                <small>人</small>
              </strong>
            </div>
            <div>
              <span>記録した日数</span>
              <strong>
                {dayCount}
                <small>日</small>
              </strong>
            </div>
          </div>
        </div>
        {loaded.error && <div className="alert error">{loaded.error}</div>}
        <Chart
          records={store.records}
          players={store.players}
          selected={selected}
          onSelection={setSelected}
        />
        <div className="entry-grid">
          <section className="panel upload-panel">
            <div className="section-top">
              <h2>
                <ImagePlus size={20} />
                スクリーンショットから記録
              </h2>
              <span className="mini-tag">画像読み取り</span>
            </div>
            <button
              className={`drop-zone ${drag ? "drag" : ""}`}
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                chooseFiles(e.dataTransfer.files);
              }}
            >
              <span className="upload-icon">
                <Upload size={24} />
              </span>
              <strong>画像をドロップ、または選択</strong>
              <span>複数枚まとめて選択できます · PNG / JPEG / WebP</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              hidden
              onChange={(e) => {
                chooseFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="subtle-note">
              <Shield size={14} />
              防御の行だけを読み取り、確認してから保存します。
            </div>
          </section>
          <section className="panel manual-panel">
            <div className="section-top">
              <h2>
                <Pencil size={19} />
                手動で記録
              </h2>
              <span className="clock">
                <Clock3 size={14} />
                {new Intl.DateTimeFormat("ja-JP", {
                  timeZone: "Asia/Tokyo",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }).format(now)}
                <small>JST</small>
              </span>
            </div>
            <form onSubmit={recordManual}>
              <div className="manual-player">
                <button
                  type="button"
                  className="avatar-button"
                  aria-label="手動記録の顔アイコンを選択"
                  onClick={() => {
                    if (manualPlayer) {
                      setEditPlayer({
                        ...store.players.find((p) => p.id === manualPlayer)!,
                      });
                    } else setPickFor("manual");
                  }}
                >
                  <Avatar
                    student={student(
                      manualPlayer
                        ? (store.players.find((p) => p.id === manualPlayer)
                            ?.iconId ?? null)
                        : iconId,
                    )}
                    size={44}
                  />
                  <Plus size={12} />
                </button>
                <label className="field grow">
                  プレイヤー
                  <select
                    aria-label="記録するプレイヤー"
                    value={manualPlayer}
                    onChange={(e) => setManualPlayer(e.target.value)}
                  >
                    <option value="">新しいプレイヤー</option>
                    {store.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {!manualPlayer && (
                <label className="field name-field">
                  プレイヤー名
                  <input
                    maxLength={100}
                    placeholder="相手のプレイヤー名"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </label>
              )}
              <div className="elapsed-input">
                <label className="field">
                  経過時間
                  <div className="number-field">
                    <input
                      type="number"
                      aria-label="何時間前"
                      min={0}
                      max={23}
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                      required
                    />
                    <span>時間</span>
                  </div>
                </label>
                <label className="field">
                  　
                  <div className="number-field">
                    <input
                      type="number"
                      aria-label="何分前"
                      min={0}
                      max={59}
                      disabled={Number(hours) > 0}
                      value={Number(hours) > 0 ? "0" : minutes}
                      onChange={(e) => setMinutes(e.target.value)}
                      required
                    />
                    <span>分前</span>
                  </div>
                </label>
                <button
                  className="primary"
                  type="submit"
                  disabled={!!loaded.error}
                >
                  <Plus size={18} />
                  記録する
                </button>
              </div>
              <p className="form-note">
                {Number(hours) > 0
                  ? "1時間以上は、ゲームの表示に合わせて分を無視します。"
                  : "現在時刻から経過時間を差し引いて記録します。"}
              </p>
            </form>
          </section>
        </div>
        <section className="panel records-panel">
          <div className="section-top">
            <div className="tabs large">
              <button
                className={listTab === "players" ? "active" : ""}
                onClick={() => setListTab("players")}
              >
                プレイヤー <span>{store.players.length}</span>
              </button>
              <button
                className={listTab === "records" ? "active" : ""}
                onClick={() => {
                  setListTab("records");
                  setPage(1);
                }}
              >
                記録一覧 <span>{store.records.length}</span>
              </button>
            </div>
            <div className="data-actions">
              <button className="text-button" onClick={exportData}>
                <Download size={15} />
                バックアップ
              </button>
              <button
                className="icon-button"
                aria-label="バックアップを復元"
                title="バックアップを復元"
                onClick={() => backupInput.current?.click()}
              >
                <ArrowDownToLine size={17} />
              </button>
              <input
                ref={backupInput}
                type="file"
                accept=".json,application/json"
                hidden
                onChange={(e) => {
                  void importBackup(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          <div className="list-tools">
            {listTab === "players" && (
              <button
                className="secondary danger-text"
                disabled={!store.players.length || !!loaded.error}
                onClick={() => setDeleteAllPlayers(true)}
              >
                <Trash2 size={16} />
                プレイヤーを一括削除
              </button>
            )}
            {listTab === "records" && (
              <button
                className="secondary danger-text"
                disabled={store.records.length === 0 || !!loaded.error}
                onClick={() => setDeleteAllRecords(true)}
              >
                <Trash2 size={16} />
                記録を一括削除
              </button>
            )}
            <label className="search-box">
              <Search size={17} />
              <input
                aria-label="プレイヤーを検索"
                placeholder="プレイヤー名・顔アイコンの生徒名で検索"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
              />
              {query && (
                <button
                  className="icon-button"
                  aria-label="検索をクリア"
                  onClick={() => setQuery("")}
                >
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              className="text-button"
              disabled={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  const next = await refreshCatalog();
                  setCatalog(next);
                  setMessage(
                    `アイコン一覧を${next.items.length}件に更新しました。`,
                  );
                } catch (e) {
                  setMessage(
                    (e as Error).message ||
                      "更新できませんでした。現在の一覧を引き続き使えます。",
                  );
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              <RefreshCw size={14} className={refreshing ? "spin" : ""} />
              {refreshing ? "更新中…" : "アイコン一覧を更新"}
            </button>
          </div>
          {listTab === "players" ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>プレイヤー</th>
                    <th>記録件数</th>
                    <th>最近の防御</th>
                    <th>ホットタイム</th>
                    <th>
                      <span className="sr-only">操作</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((p, i) => {
                    const rs = store.records.filter((r) => r.playerId === p.id);
                    const latest = Math.max(...rs.map((r) => r.at));
                    return (
                      <tr key={p.id}>
                        <td>
                          <button
                            className="player-name"
                            onClick={() => setEditPlayer({ ...p })}
                          >
                            <Avatar student={student(p.iconId)} />
                            <span>
                              <strong>{p.name}</strong>
                              <small>
                                {student(p.iconId)?.name || "アイコン未設定"}
                              </small>
                            </span>
                          </button>
                        </td>
                        <td>
                          <b>{rs.length}</b>
                          <span className="muted"> 件</span>
                        </td>
                        <td>{rs.length ? fmt(latest) : "—"}</td>
                        <td>
                          <span
                            className={`hot-badge ${rs.length < 2 ? "muted-badge" : ""}`}
                          >
                            <i
                              style={{ background: COLORS[i % COLORS.length] }}
                            />
                            {hotTime(rs)}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`${p.name}を編集`}
                            onClick={() => setEditPlayer({ ...p })}
                          >
                            <Pencil size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredPlayers.length && (
                <div className="list-empty">
                  <Users size={28} />
                  <strong>
                    {query
                      ? "一致するプレイヤーがいません"
                      : "まだプレイヤーの記録がありません"}
                  </strong>
                  <span>
                    {query
                      ? "名前や生徒名を変えて検索してください。"
                      : "画像の読み取り、または手動入力から始めましょう。"}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>プレイヤー</th>
                    <th>防御した時刻（JST）</th>
                    <th>入力時の経過時間</th>
                    <th>入力方法</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRecords.slice((page - 1) * 30, page * 30).map((r) => {
                    const p = store.players.find(
                      (p) => p.id === r.playerId,
                    ) ?? { id: "", name: "プレイヤー未設定", iconId: null };
                    return (
                      <tr key={r.id}>
                        <td>
                          <span className="player-name">
                            <Avatar student={student(p.iconId)} size={30} />
                            <strong>{p.name}</strong>
                          </span>
                        </td>
                        <td>
                          {fmt(r.at)}
                          {r.precision !== "minute" && (
                            <span className="approx">概算</span>
                          )}
                        </td>
                        <td>
                          {r.edited
                            ? "日時を直接指定"
                            : elapsedLabel(r.elapsedMinutes, r.precision)}
                        </td>
                        <td>
                          <span className="source-pill">
                            {r.source === "image" ? "画像" : "手動"}
                          </span>
                        </td>
                        <td>
                          <div className="row-actions">
                            <button
                              className="icon-button"
                              aria-label={`${p.name}の記録を編集`}
                              onClick={() => {
                                setEditRecord({ ...r });
                                setEditAt(inputDate(r.at));
                              }}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              className="icon-button danger-text"
                              aria-label={`${p.name}の記録を削除`}
                              onClick={() => setDeleteRecord(r.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!visibleRecords.length && (
                <div className="list-empty">
                  <Clock3 size={28} />
                  <strong>記録がありません</strong>
                </div>
              )}
              {visibleRecords.length > 30 && (
                <div className="pagination">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    前へ
                  </button>
                  <span>
                    {page} / {Math.ceil(visibleRecords.length / 30)}
                  </span>
                  <button
                    disabled={page * 30 >= visibleRecords.length}
                    onClick={() => setPage(page + 1)}
                  >
                    次へ
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
        <footer>
          <span>
            <HardDrive size={14} />
            記録はこのブラウザー内に保存されます。
          </span>
          <span>
            アイコン {catalog.items.length}件 · データ更新{" "}
            {new Date(catalog.updatedAt).toLocaleDateString("ja-JP")}
          </span>
        </footer>
      </main>
      {message && (
        <div className="toast" role="status">
          <span>{message}</span>
          <button aria-label="通知を閉じる" onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {editPlayer && (
        <Modal title="プレイヤーを編集" onClose={() => setEditPlayer(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editPlayer.name.trim()) return;
              const same = store.players.find(
                (p) =>
                  p.id !== editPlayer.id &&
                  normalize(p.name) === normalize(editPlayer.name),
              );
              if (same) setMergeTargetId(same.id);
              else savePlayerEdit();
            }}
          >
            <div className="edit-avatar">
              <button
                type="button"
                className="avatar-button"
                onClick={() => setPickFor("player")}
              >
                <Avatar student={student(editPlayer.iconId)} size={72} />
              </button>
              <button
                className="text-button"
                type="button"
                onClick={() => setPickFor("player")}
              >
                顔アイコンを選ぶ
                <ChevronRight size={15} />
              </button>
            </div>
            <label className="field">
              プレイヤー名
              <input
                maxLength={100}
                required
                value={editPlayer.name}
                onChange={(e) =>
                  setEditPlayer({ ...editPlayer, name: e.target.value })
                }
              />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditPlayer(null)}
              >
                キャンセル
              </button>
              <button className="primary" type="submit">
                変更を保存
              </button>
            </div>
          </form>
        </Modal>
      )}
      {mergeTargetId && editPlayer && (
        <Modal
          title="同じ名前のプレイヤーがいます"
          onClose={() => setMergeTargetId(null)}
        >
          <p>
            「{store.players.find((p) => p.id === editPlayer.id)?.name}」を「
            {editPlayer.name.trim()}
            」に変更すると、既存のプレイヤーと同じ名前になります。統合しますか？
          </p>
          <label className="field">
            統合先のプレイヤー
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
            >
              {store.players
                .filter(
                  (p) =>
                    p.id !== editPlayer.id &&
                    normalize(p.name) === normalize(editPlayer.name),
                )
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name} ·{" "}
                    {store.records.filter((r) => r.playerId === p.id).length}件
                    · {student(p.iconId)?.name ?? "アイコン未設定"}
                  </option>
                ))}
            </select>
          </label>
          <p className="muted">
            変更元の
            {store.records.filter((r) => r.playerId === editPlayer.id).length}
            件を統合先へ移し、変更元のプレイヤーを一覧から削除します。記録はすべて残ります。顔アイコンは統合先を優先し、未設定なら変更元を使います。
          </p>
          <div className="modal-actions merge-actions">
            <button
              className="text-button"
              onClick={() => setMergeTargetId(null)}
            >
              編集に戻る
            </button>
            <button className="secondary" onClick={savePlayerEdit}>
              統合せず保存
            </button>
            <button className="primary" onClick={confirmPlayerMerge}>
              統合する
            </button>
          </div>
        </Modal>
      )}
      {pickFor && (
        <IconPicker
          items={catalog.items}
          value={pickFor === "manual" ? iconId : (editPlayer?.iconId ?? null)}
          onClose={() => setPickFor(null)}
          onPick={(id) => {
            if (pickFor === "manual") setIconId(id);
            else if (editPlayer) setEditPlayer({ ...editPlayer, iconId: id });
            setPickFor(null);
          }}
        />
      )}
      {editRecord && (
        <Modal title="防御の記録を編集" onClose={() => setEditRecord(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const at = fromInput(editAt);
                if (at > Date.now())
                  throw Error("未来の時刻は指定できません。");
                const r = {
                  ...editRecord,
                  at,
                  edited: true,
                  precision: "minute" as const,
                };
                if (
                  commit({
                    ...store,
                    records: store.records.map((x) => (x.id === r.id ? r : x)),
                  })
                ) {
                  setEditRecord(null);
                  setMessage("記録を更新しました。");
                }
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            <label className="field">
              プレイヤー
              <select
                value={editRecord.playerId}
                onChange={(e) =>
                  setEditRecord({ ...editRecord, playerId: e.target.value })
                }
              >
                <option value="">プレイヤー未設定</option>
                {store.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              防御した日時（日本時間）
              <input
                type="datetime-local"
                required
                value={editAt}
                onChange={(e) => setEditAt(e.target.value)}
              />
            </label>
            <p className="muted">保存すると、指定した日時に修正します。</p>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditRecord(null)}
              >
                キャンセル
              </button>
              <button type="submit" className="primary">
                変更を保存
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleteAllPlayers && (
        <Modal
          title="すべてのプレイヤーを削除しますか？"
          onClose={() => setDeleteAllPlayers(false)}
        >
          <p className="bulk-delete-warning" role="alert">
            プレイヤー {store.players.length}
            人の名前・顔アイコンの設定と、記録との紐付けがすべて消えます。この操作は元に戻せません。
          </p>
          <p>
            防御記録 {store.records.length}
            件は残り、「プレイヤー未設定」と表示されます。全体グラフにも引き続き含まれます。検索・選択状態にかかわらず全プレイヤーが対象です。
          </p>
          <p>
            名前補正辞書とその他の設定は残ります。必要な場合は削除前にバックアップを保存してください。
          </p>
          <div className="modal-actions merge-actions">
            <button
              className="secondary"
              autoFocus
              onClick={() => setDeleteAllPlayers(false)}
            >
              キャンセル
            </button>
            <button className="secondary" onClick={exportData}>
              バックアップをダウンロード
            </button>
            <button
              className="danger"
              disabled={!store.players.length || !!loaded.error}
              onClick={() => {
                if (
                  commit({
                    ...store,
                    players: [],
                    records: store.records.map((r) => ({ ...r, playerId: "" })),
                  })
                ) {
                  setDeleteAllPlayers(false);
                  setSelected([]);
                  setManualPlayer("");
                  setQuery("");
                  setPage(1);
                  setMessage(
                    "すべてのプレイヤーを削除しました。防御記録は残しています。",
                  );
                }
              }}
            >
              全{store.players.length}人のプレイヤーを削除する
            </button>
          </div>
        </Modal>
      )}
      {deleteAllRecords && (
        <Modal
          title="すべての記録を削除しますか？"
          onClose={() => setDeleteAllRecords(false)}
        >
          <p className="bulk-delete-warning" role="alert">
            保存されている防御記録 {store.records.length}
            件がすべて消えます。この操作は元に戻せません。
          </p>
          <p>
            検索やグラフの絞り込みにかかわらず、全期間・全プレイヤーの記録が対象です。プレイヤー名・顔アイコン・名前補正辞書・設定は残ります。
          </p>
          <p>必要な場合は、削除前にバックアップをダウンロードしてください。</p>
          <div className="modal-actions merge-actions">
            <button
              className="secondary"
              autoFocus
              onClick={() => setDeleteAllRecords(false)}
            >
              キャンセル
            </button>
            <button className="secondary" onClick={exportData}>
              バックアップをダウンロード
            </button>
            <button
              className="danger"
              disabled={!store.records.length || !!loaded.error}
              onClick={() => {
                if (commit({ ...store, records: [] })) {
                  setDeleteAllRecords(false);
                  setPage(1);
                  setMessage("すべての防御記録を削除しました。");
                }
              }}
            >
              全{store.records.length}件の記録を削除する
            </button>
          </div>
        </Modal>
      )}
      {deleteRecord && (
        <Modal
          title="この記録を削除しますか？"
          onClose={() => setDeleteRecord(null)}
        >
          <p>削除した記録は元に戻せません。プレイヤーの設定は残ります。</p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setDeleteRecord(null)}>
              キャンセル
            </button>
            <button
              className="danger"
              onClick={() => {
                if (
                  commit({
                    ...store,
                    records: store.records.filter((r) => r.id !== deleteRecord),
                  })
                ) {
                  setDeleteRecord(null);
                  setMessage("記録を削除しました。");
                  setPage(1);
                }
              }}
            >
              削除する
            </button>
          </div>
        </Modal>
      )}
      {uploadFile && (
        <Modal
          title={scan ? "読み取り結果を確認" : "スクリーンショットを読み取る"}
          onClose={closeUploads}
          wide
        >
          {batchTotal > 1 && (
            <div className="upload-batch">
              <strong>
                {batchTotal - uploadQueue.length} / {batchTotal}枚目
              </strong>
              <span>{uploadFile.name}</span>
              <small>確認・保存すると次の画像を自動で読み取ります。</small>
              {uploadQueue.length > 0 && (
                <details>
                  <summary>待機中の画像 {uploadQueue.length}枚</summary>
                  <ul>
                    {uploadQueue.map((file, i) => (
                      <li key={i}>{file.name}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
          {!scan ? (
            <>
              <div className="image-preview">
                <img src={preview} alt="選択した対抗戦履歴" />
                {adjust && (
                  <div
                    className="roi-outline"
                    style={{
                      left: `${region.x}%`,
                      top: `${region.y}%`,
                      width: `${region.width}%`,
                      height: `${region.height}%`,
                    }}
                  />
                )}
              </div>
              <div className="scan-file">
                <span>{uploadFile.name}</span>
                <button
                  className="text-button"
                  disabled={!!progress}
                  onClick={() => setAdjust(!adjust)}
                >
                  <SlidersHorizontal size={15} />
                  読み取り範囲
                </button>
              </div>
              {adjust && (
                <div className="roi-controls">
                  {(
                    [
                      ["x", "左"],
                      ["y", "上"],
                      ["width", "幅"],
                      ["height", "高さ"],
                    ] as const
                  ).map(([key, label]) => (
                    <label className="field" key={key}>
                      {label}（%）
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={region[key]}
                        onChange={(e) =>
                          setRegion({
                            ...region,
                            [key]: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                  <button
                    className="text-button"
                    onClick={() => setRegion(DEFAULT_REGION)}
                  >
                    標準に戻す
                  </button>
                </div>
              )}
              <p className="muted">
                盾アイコンの防御行を確認してから記録します。画面の端で切れた行は除外します。
              </p>
              {progress && (
                <div className="progress-line" role="status">
                  <LoaderCircle className="spin" size={18} />
                  {progress}
                </div>
              )}
              <div className="modal-actions">
                {progress ? (
                  <button className="secondary" onClick={cancelScan}>
                    中止
                  </button>
                ) : (
                  <>
                    {batchTotal > 1 && (
                      <button
                        className="secondary"
                        onClick={() =>
                          advanceFile("この画像をスキップしました。")
                        }
                      >
                        この画像をスキップ
                      </button>
                    )}
                    <button className="primary" onClick={() => void runScan()}>
                      <ImagePlus size={17} />
                      画像を読み取る
                    </button>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="time-source">
                基準時刻の取得元：
                <strong>{TIME_SOURCE_LABELS[scan.timeSource]}</strong>
                {baseAt !== inputDate(scan.baseAt) && "（手動で変更済み）"}
              </div>
              {(scan.timeSource === "modified" ||
                scan.timeSource === "current") && (
                <div className="alert">
                  {scan.timeSource === "modified"
                    ? "画像内の日時・規定形式のファイル名がないため、ファイル更新日時を基準に記録します。"
                    : "日時を取得できないため、現在時刻を基準に記録します。"}
                </div>
              )}
              <label className="field reference-time">
                基準時刻（日本時間）
                <input
                  type="datetime-local"
                  value={baseAt}
                  onChange={(e) => setBaseAt(e.target.value)}
                  required
                />
              </label>
              <p className="muted">
                名前・時間・攻防を確認してください。保存する防御行にチェックを入れます。
                {scan.skipped > 0 &&
                  ` 端が切れた${scan.skipped}行は除外しました。`}
              </p>
              <div className="scan-results">
                {scan.rows.map((row, i) => (
                  <div
                    className={`scan-row ${row.role === "attack" ? "excluded" : ""}`}
                    key={row.id}
                  >
                    <img
                      className="row-thumbnail"
                      src={row.thumbnail}
                      alt={`${i + 1}行目の元画像`}
                    />
                    <div className="scan-row-fields">
                      <label className="check-field">
                        <input
                          type="checkbox"
                          aria-label={`${i + 1}行目を保存`}
                          disabled={row.role !== "defense"}
                          checked={row.selected && row.role === "defense"}
                          onChange={(e) =>
                            changeRow(row.id, { selected: e.target.checked })
                          }
                        />
                        保存
                      </label>
                      <label className="field">
                        攻防
                        <select
                          value={row.role}
                          onChange={(e) =>
                            changeRow(row.id, {
                              role: e.target.value as Candidate["role"],
                              selected: e.target.value === "defense",
                            })
                          }
                        >
                          <option value="defense">防御（盾）</option>
                          <option value="attack">攻撃（対象外）</option>
                          <option value="unknown">要確認</option>
                        </select>
                      </label>
                      <label className="field grow">
                        プレイヤー
                        <select
                          value={row.playerId}
                          onChange={(e) =>
                            changeRow(row.id, { playerId: e.target.value })
                          }
                        >
                          <option value="__auto__">
                            同じ名前にまとめる（既定）
                          </option>
                          <option value="">新規として個別登録</option>
                          {store.players.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        {(!row.playerId || row.playerId === "__auto__") && (
                          <input
                            aria-label={`${i + 1}行目の名前`}
                            maxLength={100}
                            placeholder="名前を確認"
                            value={row.name}
                            onChange={(e) =>
                              changeRow(row.id, { name: e.target.value })
                            }
                          />
                        )}
                      </label>
                      <label className="field">
                        経過時間
                        <div className="row-elapsed">
                          <input
                            aria-label={`${i + 1}行目の経過時間`}
                            type="number"
                            min={0}
                            value={
                              row.minutes === null
                                ? ""
                                : row.precision === "hour"
                                  ? row.minutes / 60
                                  : row.precision === "day"
                                    ? row.minutes / 1440
                                    : row.minutes
                            }
                            onChange={(e) =>
                              changeRow(row.id, {
                                minutes:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value) *
                                      (row.precision === "hour"
                                        ? 60
                                        : row.precision === "day"
                                          ? 1440
                                          : 1),
                              })
                            }
                          />
                          <select
                            aria-label={`${i + 1}行目の時間単位`}
                            value={row.precision}
                            onChange={(e) => {
                              const v = e.target
                                .value as Candidate["precision"];
                              const oldUnit =
                                row.precision === "hour"
                                  ? 60
                                  : row.precision === "day"
                                    ? 1440
                                    : 1;
                              changeRow(row.id, {
                                precision: v,
                                minutes:
                                  row.minutes === null
                                    ? null
                                    : (row.minutes / oldUnit) *
                                      (v === "hour"
                                        ? 60
                                        : v === "day"
                                          ? 1440
                                          : 1),
                              });
                            }}
                          >
                            <option value="minute">分前</option>
                            <option value="hour">時間前</option>
                            <option value="day">日前</option>
                          </select>
                        </div>
                      </label>
                    </div>
                    <div className="scan-row-note">
                      {row.rawName !== row.name &&
                        `名前補正：${row.rawName} → ${row.name}。 `}
                      {row.role === "attack"
                        ? "攻撃の履歴は保存されません。"
                        : row.confidence < 75
                          ? "読み取りに不確かな箇所があります。元画像と確認してください。"
                          : "元画像と照合してから保存してください。"}
                      {row.name === "匿名" &&
                        " 匿名も既定では同じ名前にまとめます。別人として残す場合は「新規として個別登録」を選んでください。"}
                    </div>
                  </div>
                ))}
              </div>
              <label className="remember-names">
                <input
                  type="checkbox"
                  checked={rememberNames}
                  onChange={(e) => setRememberNames(e.target.checked)}
                />
                修正した名前を次回の読み取りに使う
              </label>
              <div className="modal-actions">
                {batchTotal > 1 && (
                  <button
                    className="secondary"
                    onClick={() => advanceFile("この画像をスキップしました。")}
                  >
                    この画像をスキップ
                  </button>
                )}
                <button className="secondary" onClick={() => setScan(null)}>
                  読み直す
                </button>
                <button
                  className="primary"
                  onClick={saveScan}
                  disabled={
                    !!loaded.error ||
                    !scan.rows.some((r) => r.selected && r.role === "defense")
                  }
                >
                  <Check size={17} />
                  選択した防御を保存
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {restore && (
        <Modal title="バックアップを取り込む" onClose={() => setRestore(null)}>
          <p>
            {restore.players.length}人・{restore.records.length}
            件の記録を取り込みます。同じIDの記録は追加しません。
          </p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setRestore(null)}>
              キャンセル
            </button>
            <button
              className="primary"
              onClick={() => {
                if (commit(mergeStores(store, restore))) {
                  setRestore(null);
                  setMessage("バックアップを取り込みました。");
                }
              }}
            >
              取り込む
            </button>
          </div>
        </Modal>
      )}
      {duplicateReview && (
        <Modal
          title="重複する記録の確認"
          onClose={() => setDuplicateReview(null)}
        >
          <p>
            重複候補が{duplicateReview.ids.length}
            件あります。追加するか選んでください。
          </p>
          <p className="muted">
            同じ画像の同じ行、または同じプレイヤー・同じ分の防御が対象です。時刻は概算のため、別の防御の場合もあります。
          </p>
          <ul>
            {duplicateReview.next.records
              .filter((r) => duplicateReview.ids.includes(r.id))
              .map((r) => (
                <li key={r.id}>
                  {
                    duplicateReview.next.players.find(
                      (p) => p.id === r.playerId,
                    )?.name
                  }{" "}
                  · {fmt(r.at)}
                </li>
              ))}
          </ul>
          <label className="field">
            重複候補の扱い
            <select
              value={String(addDuplicates)}
              onChange={(e) => setAddDuplicates(e.target.value === "true")}
            >
              <option value="false">追加しない</option>
              <option value="true">追加する</option>
            </select>
          </label>
          <p className="muted">
            重複していない記録は通常どおり追加します。初期選択は「使い方」で変更できます。
          </p>
          <div className="modal-actions">
            <button
              className="secondary"
              onClick={() => setDuplicateReview(null)}
            >
              戻る
            </button>
            <button className="primary" onClick={finishDuplicateReview}>
              この内容で確定
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="使い方" onClose={() => setHelp(false)}>
          <label className="field">
            重複確認時の初期選択
            <select
              value={String(duplicateDefault)}
              onChange={(e) => {
                const value = e.target.value === "true";
                try {
                  localStorage.setItem(
                    "ba-pvp-hottime.add-duplicates",
                    String(value),
                  );
                  setDuplicateDefault(value);
                } catch {
                  setMessage("設定を保存できませんでした。");
                }
              }}
            >
              <option value="false">重複を追加しない（初期設定）</option>
              <option value="true">重複を追加する</option>
            </select>
          </label>
          <p className="muted">
            設定はこのブラウザーに保存します。どちらの設定でも、重複候補がある場合は保存前に確認します。
          </p>
          <div className="help-content">
            <p>
              <b>画像から記録</b>
              <br />
              履歴画面を選び、読み取り結果を確認して保存します。盾アイコンの「防御」が対象です。
            </p>
            <p>
              <b>時間の扱い</b>
              <br />
              画像内の日時、規定形式のファイル名、ファイル更新日時、現在時刻の順に基準時刻を選び、経過時間を差し引きます。取得元を確認画面に表示し、日時は修正できます。ファイル名は「BlueArchive
              YYYY-MM-DD
              HHMMSS_番号.png」形式に対応します。1時間以上は分を無視します。日単位の表示も概算で扱います。
            </p>
            <p>
              <b>グラフとホットタイム</b>
              <br />
              ヒートマップは日付で分けず、選択期間の記録を時間帯別に合算します。色が濃いほど件数が多くなります。棒グラフは1時間単位の件数を表示します。ホットタイムは全記録で最も件数が多い時台を表示し、同率はすべて並べます。2件未満ではデータ不足と表示します。
            </p>
            <p>
              <b>顔アイコン</b>
              <br />
              プレイヤーの編集から選択できます。「アイコン一覧を更新」でスプレッドシートの最新データを読み込みます。
            </p>
            <p>
              <b>保存とバックアップ</b>
              <br />
              記録と画像の読み取りはブラウザー内で処理します。ブラウザーのデータ消去に備え、バックアップをご利用ください。元画像は保存しません。
            </p>
            <p>
              <b>重複について</b>
              <br />
              手入力・画像登録では、同じ画像の同じ行、または同じプレイヤーで防御時刻が分単位で一致する記録を重複候補として確認します。日時が異なる別画像の重なりは検出できない場合があります。新規として個別登録した別プレイヤーは、名前だけでは重複扱いにしません。
            </p>
            <p>
              <b>名前の補正</b>
              <br />
              確認画面で修正した名前は、次回の同じ誤読に適用できます。生徒名をプレイヤー名の辞書としては使いません。
            </p>
            <button
              className="secondary"
              disabled={!store.corrections?.length}
              onClick={() => {
                if (commit({ ...store, corrections: [] }))
                  setMessage("学習した名前補正をクリアしました。");
              }}
            >
              名前補正をクリア（{store.corrections?.length ?? 0}件）
            </button>
          </div>
        </Modal>
      )}
    </NoticeContext.Provider>
  );
}
