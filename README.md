# 📊 pbirdoc

**pbirdoc** is a web app designed to help **Power BI report developers** quickly document and explore the **layout and structure** of their reports.

Rather than focusing on the semantic model, **pbirdoc** analyzes the `.pbir` files to provide insights into:

- 🧭 Report page layouts and visual arrangements  
- 📊 Types of visualizations used across the report  
- 📌 Fields and measures used in each visual  
- 🧾 Filters applied globally or at the visual level  

This tool is ideal for developers who want a **clear overview** of how a Power BI report is built — enabling easier auditing, documentation, and collaboration across teams.

---

## 🚀 Features

- Upload `.pbir` files to extract report structure
- Interactive UI to browse visuals and their properties
- Identify fields, tables, and filters used in each visual
- Simple, fast, and intuitive interface

## 📁 Supported Files

- `.pbir` (Power BI report layout files)

## 🛠️ Tech Stack
Pending to specify, right now I'm working in the schema definition parser using javascript.
**Tentative Stack**
- Next.js
- tailwindcss

## 📌 Coming Soon

- Semantic model (.pbip) support
- Exportable documentation
- Integration with version control systems

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
