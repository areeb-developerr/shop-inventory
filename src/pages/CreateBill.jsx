import React, { useState } from "react";
import {
  ShoppingCart,
  Receipt,
  CreditCard,
  User,
  Package,
  AlertCircle,
  CheckCircle,
  Plus,
} from "lucide-react";
import BillForm from "../components/BillForm.jsx";

export default function CreateBill() {
  const [showSuccess, setShowSuccess] = useState(false);

  const handleBillSaved = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 5000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold page-heading flex items-center">
            <ShoppingCart className="h-8 w-8 mr-3 text-blue-600" />
            New Sale
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Search products, add to cart, and complete the sale transaction
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Ready for sale</span>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
          <div>
            <p className="text-green-800 dark:text-green-200 font-medium">
              Sale completed successfully!
            </p>
            <p className="text-green-700 dark:text-green-300 text-sm">
              The invoice has been printed and inventory has been updated.
            </p>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-0.5" />
          <div>
            <h3 className="text-blue-800 dark:text-blue-200 font-medium">
              How to complete a sale
            </h3>
            <ol className="text-blue-700 dark:text-blue-300 text-sm mt-2 space-y-1 list-decimal list-inside">
              <li>
                Search for products in the left panel and click "Add" to add
                them to cart
              </li>
              <li>Adjust quantities and prices in the cart as needed</li>
              <li>Enter customer name (optional) for better record keeping</li>
              <li>
                Click "Save Bill" to complete the transaction and print receipt
              </li>
            </ol>
          </div>
        </div>
      </div>

      {/* Main Sale Interface */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <Package className="h-6 w-6 mr-2 text-gray-600 dark:text-gray-400" />
            Point of Sale
          </h2>
          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              System Online
            </div>
            <div>
              {new Date().toLocaleDateString()} •{" "}
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        <BillForm onSaved={handleBillSaved} />
      </div>
    </div>
  );
}
