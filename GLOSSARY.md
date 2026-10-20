# ZE Order & Billing

Zahir Enterprise (ZE) buys packaging products from Supplier factories and resells them to Customers, back-to-back, without holding stock. This app records who buys what at which price, who makes it at which price, and the documents for each Order.

## Parties

**ZE**:
Zahir Enterprise, the business that uses the app.

**User**:
A ZE staff member who logs in. Has exactly one role: Admin, Manager or Staff.
_Avoid_: Employee, account

**Customer**:
A shop or business that buys products from ZE. Never logs in.
_Avoid_: Client, buyer

**Supplier**:
A factory that makes products for ZE. Never logs in.
_Avoid_: Vendor, manufacturer, client

## Catalogue

**Product**:
An item ZE sells to one specific Customer, made by a set Supplier, with its own Sell price and Buy price. The same physical item sold to two Customers is two Products.
_Avoid_: Item, SKU, Customer Product, Supplier Product

**Sell price**:
Price per piece ZE charges the Customer.

**Buy price**:
Price per piece ZE pays the Supplier.

## Orders

**Order**:
One Customer's request for one or more Products, and the parent of its Work Orders, Challan and Invoice.
_Avoid_: Purchase, job

**Order Item**:
One line of an Order: a Product, a quantity, and the Sell and Buy prices frozen at the time the line was added.
_Avoid_: Line item, row

**Margin**:
Sell total minus Buy total. ZE's gross profit on an Order Item or Order.
_Avoid_: Profit, markup

**Margin %**:
Margin divided by Sell total.
_Avoid_: Markup %

**Lock**:
State of an Invoiced or Completed Order in which nobody can edit it. Only an Admin can **Unlock** it, with a reason.

## Documents

**Work Order (WO)**:
The document ZE sends a Supplier to order goods. One per Supplier per Order. Shows Buy prices only.
_Avoid_: Purchase order, PO

**Challan**:
The delivery note ZE hands the Customer with the goods. One per Order. Shows no prices.
_Avoid_: Delivery note, DN

**Invoice**:
The document asking the Customer to pay. One per Order. Shows Sell prices and total.
_Avoid_: Bill

**Needs re-send**:
Flag on a WO or Challan that was already sent but no longer matches its Order after an edit.

## Oversight

**Activity Log**:
The permanent record of every change any User makes in the app, visible to Admins.
_Avoid_: Audit trail, history
