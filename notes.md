# NOTES; not complete at all!


### Get initial account data.

Each script waits 2 seconds between each fetch to make sure the script it not too spammy.

1. `1-fetch-all.js` - fetches all transactions for the selected account.
2. `2-combine-all.js` - combines said transactions into a singel file and prints the total transaction count, please verify that this number matches the number of transactions that exist on your account. For SEB, download the CSV and make sure the total rows is the number you got -1 (because of the csv header)
3. `3-fetch-all-details.js` - fetches the details for all transactions that have one.
4. `4-fetch-all-invoices.js` - fetches the invoices for all transactions that have one connected.


Fetches transactions to 5 years
Fetches information about transactions to 2 years

code
41 - kortbetalning
141 - swish (details)
82 - e-faktura (details) --> gives pdf!
184 - stående övervöring

10 - DirectDebit
180 - Seb transer
990 - Other, t.ex. refunds

182 - Transfer (details)
71 - kortköp utland

### how it works

1. create expense/revenue accounts based on transaction details.


182 type is transfer out of account, this can have a detail with typecode 181
180 is type for incoming transfer, it does not have a detail


### transactions findings:
all has:
entry_date_time
value_date
posting_date
reference_id -- verification_number_customer
descriptive_text
transaction_amount
message1

(990 is other, refunds or fees)

merchant_name exists on card purshaese etc, should be used as "destination on those"  // Set(3) { 41, 990, 71 }
purchase_date exists on card purcahses etc, // Set(3) { 41, 990, 71 }
original_amount exists on utlandsköp // Set(2) { 41, 71 }
link exists on things with details!
message3 is a little random it looks like!
exchange rate seams to exist where original_amount eixsts! // Set(2) { 41, 71 }



always null:
instructed_amount
instructed_amount_currency
has_details
swishDetails
bgc_ticket_data


### details findings:



einvoiceUrl - its has an einvoice
invoice_id when invoice
e_invoice_url
ticket_data (has to do other qurey for this etc etc)



bank_prefix - for me only "SEB" but when sending between accounts/banks?
message_from_sender- when message exists
message_to_receiver - when message exists, swish uses this one!!!

seb_unique_accounting_transaction_id seasm to be not swish ones

from_account - is my account number when it exists
to_account - is the account number it sent to when exists

transaction_date - date

debit_value_date - between account transer?

recipients_name - big case of recipient name

account - seams to always be mine


receiver_name when swish
receiver_swish_number
sender_name - when swish, if no reciver_name or reciver swish number, its to a company. use recipents name
sender_swish_number - number of swisher
transaction_time
swish_reference_id
reference_id - same all the time when swish
senders_name_address swish name but uppercase

payment_type - null (swish), PG, BG, SEB

posting_date - should match with data from transaction

transaction_details_link always there

voucher_number seasm to be when i paid, not swish
ocr_message same as voucher_number

own_note not for swish other can have this

transaction_type_label "payment" for those that has it

description alwasys string, seams to be like the tranaction message?

bg_pg_number bg, pg number where it exists

--this when using kivra/tink
third_party_provider_name
third_party_provider_reference
third_party_provider_reg_timestamp

always null:
avi_text
original_suti
service_code
third_party_provider_end_to_end_id
to_clearing_number
bic
