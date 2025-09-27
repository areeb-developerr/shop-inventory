import React, { useState, useEffect, memo } from "react";
import {
  subscribeSettings,
  formatCurrency,
  formatDate,
  getSettingsSync,
} from "../services/settings";

function BillTable({ bills }) {
  const [settings, setSettings] = useState(getSettingsSync());

  useEffect(() => {
    const unsubscribe = subscribeSettings((newSettings) => {
      setSettings(newSettings);
    });
    return unsubscribe;
  }, []);

  return (
    <div className="overflow-auto">
      <table className="min-w-full">
        <thead className="sticky top-0 bg-white dark:bg-gray-800">
          <tr className="text-left border-b dark:border-gray-700">
            <th className="p-2">Date</th>
            <th className="p-2">Customer</th>
            <th className="p-2">Items</th>
            <th className="p-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {bills.length ? (
            bills.map((b) => (
              <tr key={b._id} className="border-b dark:border-gray-700">
                <td className="p-2">{formatDate(b.date, true)}</td>
                <td className="p-2">{b.customerName || "Walk-in Customer"}</td>
                <td className="p-2 truncate max-w-[40ch]">
                  {(b.items || [])
                    .map((i) => `${i.name} x${i.quantity}`)
                    .join(", ")}
                </td>
                <td className="p-2 text-right font-semibold">
                  {formatCurrency(Number(b.totalAmount || 0))}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan="4"
                className="p-4 text-gray-500 dark:text-gray-400 text-center"
              >
                No bills yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default memo(BillTable);
