// Removed the import statement for bitcoinjs-lib and privateKeyToPublicKey function

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#generatekeypair').addEventListener('click', generateKeyPair);
  document.querySelector('#mineBlocks').addEventListener('click', mineBlocks);
});

let keyPairCounter = 0;

async function generateKeyPair(event) {
  event.preventDefault();

  try {
    const response = await fetch("http://203.18.30.236:8080/generate-keypair", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    const publicKey = result.publicKey; // Use the publicKey returned from the server

    const keyPairTableBody = document.getElementById("keypairTableBody");
    const row = document.createElement("tr");

    const indexCell = document.createElement("td");
    const publicKeyCell = document.createElement("td");
    const privateKeyCell = document.createElement("td");
    const addressCell = document.createElement("td");

    indexCell.innerText = keyPairTableBody.children.length + 1;
    publicKeyCell.innerText = publicKey;
    privateKeyCell.innerText = result.privateKey;
    addressCell.innerText = result.address;

    row.appendChild(indexCell);
    row.appendChild(publicKeyCell);
    row.appendChild(privateKeyCell);
    row.appendChild(addressCell);

    keyPairTableBody.appendChild(row);
  } catch (error) {
    console.error("Error:", error);
  }
}

// Rest of your code remains unchanged




function addToKeyPairTable(keyPairData) {
  const tableBody = document.querySelector('#keypairTableBody');
  const newRow = document.createElement('tr');

  // Add a new column for the index in each row
  const indexCell = document.createElement('td');
  keyPairCounter++;
  indexCell.innerText = keyPairCounter;
  newRow.appendChild(indexCell);

  const publicKeyCell = document.createElement('td');
  publicKeyCell.innerText = keyPairData.public_key;
  newRow.appendChild(publicKeyCell);

  const privateKeyCell = document.createElement('td');
  privateKeyCell.innerText = keyPairData.private_key;
  newRow.appendChild(privateKeyCell);

  tableBody.appendChild(newRow);

  // Add options to the drop-down menu when new key pairs are generated
  const keyPairSelector = document.querySelector('#keyPairSelector');
  const newOption = document.createElement('option');
  newOption.value = keyPairCounter;
  newOption.innerText = `Index ${keyPairCounter}`;
  keyPairSelector.appendChild(newOption);
}

async function mineBlocks() {
  const keyPairSelector = document.querySelector('#keyPairSelector');
  const selectedIndex = keyPairSelector.value;

  console.log(`Mining 110 blocks to address with index: ${selectedIndex}`);

  try {
    const response = await fetch(`http://203.18.30.236:8080/api/mine-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ index: selectedIndex }),
    });

    if (!response.ok) {
      throw new Error('Error mining blocks');
    }

    const minedData = await response.json();
    populateSpendableTransactionOutputs(minedData);
  } catch (error) {
    console.error('Error:', error);
  }
}

function populateSpendableTransactionOutputs(minedData) {
  const stoTableBody = document.querySelector('#stoTable tbody');

  minedData.forEach((output, index) => {
    const newRow = document.createElement('tr');

    const indexCell = document.createElement('td');
    indexCell.innerText = index;
    newRow.appendChild(indexCell);

    const txidCell = document.createElement('td');
    txidCell.innerText = output.txid;
    newRow.appendChild(txidCell);

    const satoshisCell = document.createElement('td');
    satoshisCell.innerText = output.satoshis;
    newRow.appendChild(satoshisCell);

    const lockingScriptCell = document.createElement('td');
    lockingScriptCell.innerText = output.locking_script;
    newRow.appendChild(lockingScriptCell);

    const blocksSinceMinedCell = document.createElement('td');
    blocksSinceMinedCell.innerText = output.blocks_since_mined;
    newRow.appendChild(blocksSinceMinedCell);

    const privateKeyCell = document.createElement('td');
privateKeyCell.innerText = output.private_key;
newRow.appendChild(privateKeyCell);

stoTableBody.appendChild(newRow);

});
}
