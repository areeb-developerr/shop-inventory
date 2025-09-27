import React, { useMemo, useState, useEffect, memo, useRef } from "react";
import { FixedSizeList as List } from "react-window";
import { Edit, Trash2 } from "lucide-react";
import {
  subscribeSettings,
  formatCurrency,
  getSettingsSync,
} from "../services/settings";

function ProductTable({ products, onEdit, onDelete }) {
  const [settings, setSettings] = useState(getSettingsSync());

  useEffect(() => {
    const unsubscribe = subscribeSettings((newSettings) => {
      setSettings(newSettings);
    });
    return unsubscribe;
  }, []);

  const rows = useMemo(() => products, [products]);

  const containerRef = useRef(null);
  const ROW_HEIGHT = 52;

  const Row = ({ index, style }) => {
    const p = rows[index];
    if (!p) return null;
    const isLow =
      Number(p.quantity) <=
      (Number(p.minStock) || Number(settings.lowStockThreshold) || 5);
    return (
      <div style={style} className={`flex border-b dark:border-gray-700 items-center ${index % 2 ? "bg-white/50 dark:bg-transparent" : ""}`}>
        <div className="p-2 flex-1 min-w-[16rem]">{p.name}</div>
        <div className="p-2 w-40 truncate">{p.category}</div>
        <div className={`p-2 w-24 ${isLow ? "text-red-600 font-semibold" : ""}`}>{p.quantity}</div>
        <div className="p-2 w-32">{formatCurrency(Number(p.costPrice || 0))}</div>
        <div className="p-2 w-32">{formatCurrency(Number(p.defaultSellPrice || 0))}</div>
        <div className="p-2 w-40">
          <div className="flex gap-2">
            <button onClick={() => onEdit(p)} title="Edit Product" className="p-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded">
              <Edit className="h-4 w-4" />
            </button>
            <button onClick={() => onDelete(p._id)} title="Delete Product" className="p-2 bg-red-600 hover:bg-red-700 text-white rounded">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (!rows.length) {
    return (
      <div className="p-4 text-gray-500 dark:text-gray-400 text-center">No products yet.</div>
    );
  }

  return (
    <div className="overflow-auto max-h-[70vh] rounded-lg" ref={containerRef}>
      <div className="sticky top-0 bg-gray-100 dark:bg-gray-900 z-10 border-b dark:border-gray-700">
        <div className="flex text-left">
          <div className="p-2 flex-1 min-w-[16rem] font-medium">Name</div>
          <div className="p-2 w-40 font-medium">Category</div>
          <div className="p-2 w-24 font-medium">Qty</div>
          <div className="p-2 w-32 font-medium">Cost</div>
          <div className="p-2 w-32 font-medium">Sell</div>
          <div className="p-2 w-40 font-medium">Actions</div>
        </div>
      </div>
      <List
        height={Math.min(rows.length * ROW_HEIGHT, Math.floor(window.innerHeight * 0.7))}
        itemCount={rows.length}
        itemSize={ROW_HEIGHT}
        width={containerRef.current?.clientWidth || "100%"}
      >
        {Row}
      </List>
    </div>
  );
}

export default memo(ProductTable);
