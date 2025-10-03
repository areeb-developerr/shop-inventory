import React from "react";
import Package from "lucide-react/dist/esm/icons/package";

export default function About() {
  return (
    <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow p-8">
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
          <Package className="h-6 w-6 text-white" />
        </div>
        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          ShopFlow Inventory
        </h2>
      </div>
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        ShopFlow Inventory is a modern, offline-first inventory and sales
        management system for small businesses. Easily manage products, sales,
        customers, and analytics—all in one place.
      </p>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">
          Features
        </h3>
        <ul className="list-disc pl-6 text-gray-600 dark:text-gray-400 space-y-1">
          <li>Low stock alerts and notifications</li>
          <li>Quick billing and sales history</li>
          <li>Customer management and analytics</li>
          <li>Customizable settings and themes</li>
        </ul>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-5">
          About the Developer
        </h3>
        <div className="mb-3">
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            Created by:{" "}
          </span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold">
            Areeb Asif
          </span>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              Developer's Github:{" "}
            </span>
            <a
              href="https://github.com/areeb-developerr"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors duration-200 font-medium"
            >
              GitHub Profile
            </a>
          </div>
          <div>
            <span className="text-gray-700 dark:text-gray-300 font-medium">
              Developer's Portfolio:{" "}
            </span>
            <a
              href="https://areeb-portfolio--1.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors duration-200 font-medium"
            >
              Portfolio
            </a>
          </div>
        </div>
      </div>

      <div className="text-xs items-center text-center justify-center text-gray-400 dark:text-gray-500">
        &copy; {new Date().getFullYear()} ShopFlow. All rights reserved.
      </div>
    </div>
  );
}
