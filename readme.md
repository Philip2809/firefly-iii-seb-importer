# Firefly III SEB Importer
Import transaction data from SEB


The script reflects how your SEB accounts look in firefly. Currently the scripts have to be run separatly but at some point I will put all this into a docker container so the plugin can send the data directly there and it happens more automatically. 

The project has 3 parts. 
1. `first_setup` - I wanted firefly to have as many of my existing transactions as possible; so these scripts are to made for that. It's not the most polished scripts, nor will I work on these more, but use them as a referance if you want to do the same.
2. `seb-creds-copy` - The SEB api uses cookie credentails; because it is cumbersome to copy this from the browser easily this firefox plugin was made; to easily get the needed credentials once you have logged into SEB. Paste the details into `./updates/.creds.json`
3. `updates` - The scripts for continues updates to firefly. Enter your credentails, fill in `.firefly.json`. with the firefly info.
    - Run `main.js` to fetch the transaction data from seb and upload the new ones!
    - Run `funds.js` to fetch the market value of your funds and create a transaction to keep the value of the account the same as in SEB
        - Note: you need to enter the account id in this file

### TODO:
- Run this in a container and extentaion sends a request with creds to update
- invoice upload for updates (will do when i have invoices again)
- Fetch data from different providers to get recipets etc. Kivra for alot of places