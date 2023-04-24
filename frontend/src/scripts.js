document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#generatekeypair').addEventListener('click', generateKeyPair);
  document.querySelector('#mineBlocks').addEventListener('click', mineBlocks);
});


async function generateKeyPair(event) {
  event.preventDefault();

  try {
    const response = await fetch("http://203.18.30.236:8090/generate-keypair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();
    const publicKey = result.publicKey;

    const keyPairTableBody = document.getElementById("keypairTableBody");
    const row = document.createElement("tr");

    const indexCell = document.createElement("td");
    const publicKeyCell = document.createElement("td");
    const privateKeyCell = document.createElement("td");
    const addressCell = document.createElement("td");

    // Define the index variable
    const index = keyPairTableBody.children.length + 1;

    indexCell.innerText = index;
    publicKeyCell.innerText = publicKey;
    privateKeyCell.innerText = result.privateKey;
    addressCell.innerText = result.address;

    row.appendChild(indexCell);
    row.appendChild(publicKeyCell);
    row.appendChild(privateKeyCell);
    row.appendChild(addressCell);

    keyPairTableBody.appendChild(row);

    // Add options to the drop-down menu when new key pairs are generated
    const keyPairSelector = document.querySelector('#keyPairSelector');
    const newOption = document.createElement('option');
    newOption.value = index;
    newOption.innerText = `Index ${index}`;
    keyPairSelector.appendChild(newOption);
  } catch (error) {
    console.error("Error:", error);
  }
}

async function mineBlocks() {
  const keyPairSelector = document.querySelector('#keyPairSelector');
  const selectedIndex = keyPairSelector.value;

  // Get the address from the table
  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const addressCell = selectedRow.children[3];
  const selectedAddress = addressCell.innerText;

  console.log(`Mining 110 blocks to address with index: ${selectedIndex}`);

  try {
    const response = await fetch(`http://203.18.30.236:8090/api/mine-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address: selectedAddress }),
    });

    if (!response.ok) {
      throw new Error('Error mining blocks');
    }

    const minedData = await response.json();
    console.log('Mined data:', minedData);
    populateSpendableTransactionOutputs(minedData.transactions);
  } catch (error) {
    console.error('Error:', error);
  }
}

// Add this helper function to fetch transaction details from the Woc explorer API
async function fetchTransactionDetails(txHash) {
  const response = await fetch(`http://203.18.30.236:8090/api/proxy-transaction-details?txHash=${txHash}`);
  
  if (!response.ok) {
    throw new Error(`HTTP error ${response.status}`);
  }

  const txDetails = await response.json();
  return txDetails;
}

async function populateSpendableTransactionOutputs(transactions) {
  const stoTableBody = document.querySelector('#stoTable > tbody');
  const keyPairSelector = document.querySelector('#keyPairSelector');
  const selectedIndex = keyPairSelector.value;

  // Get the private key from the table
  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const privateKeyCell = selectedRow.children[2];
  const selectedPrivateKey = privateKeyCell.innerText;

  stoTableBody.innerHTML = ''; // clear the table before populating new data

  for (const transaction of transactions) {
    const txDetails = await fetchTransactionDetails(transaction.txid);
    const output = txDetails.vout[0];

    const newRow = document.createElement('tr');

    let cellIndex = newRow.insertCell();
    cellIndex.innerText = transaction.n;

    let cellBlockHeight = newRow.insertCell();
    cellBlockHeight.innerText = transaction.blockheight;

    let cellBlockHash = newRow.insertCell();
    cellBlockHash.innerText = transaction.blockhash;

    let cellVout = newRow.insertCell();
    cellVout.innerText = output.n;

    let cellTxid = newRow.insertCell();
    cellTxid.innerText = transaction.txid;

    let cellValue = newRow.insertCell();
    cellValue.innerText = output.value;

    let cellScriptPubKeyAsm = newRow.insertCell();
    cellScriptPubKeyAsm.innerText = output.scriptPubKey.asm;

    let cellScriptPubKeyHex = newRow.insertCell();
    cellScriptPubKeyHex.innerText = output.scriptPubKey.hex;

    let cellReqSigs = newRow.insertCell();
    cellReqSigs.innerText = output.scriptPubKey.reqSigs;

    let cellConfirmations = newRow.insertCell();
    cellConfirmations.innerText = transaction.confirmations;

    let cellPrivateKey = newRow.insertCell();
    cellPrivateKey.innerText = selectedPrivateKey;

    newRow.appendChild(cellIndex);
    newRow.appendChild(cellBlockHeight);
    newRow.appendChild(cellBlockHash);
    newRow.appendChild(cellVout);
    newRow.appendChild(cellTxid);
    newRow.appendChild(cellValue);
    newRow.appendChild(cellScriptPubKeyAsm);
    newRow.appendChild(cellScriptPubKeyHex);
    newRow.appendChild(cellReqSigs);
    newRow.appendChild(cellConfirmations);
    newRow.appendChild(cellPrivateKey);

    stoTableBody.appendChild(newRow);
  }
}



