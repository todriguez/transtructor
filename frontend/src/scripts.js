/* document.addEventListener("DOMContentLoaded", function () {
  const displayPreImagesButton = document.getElementById("displayPreImagesButton");
  if (displayPreImagesButton) {
    displayPreImagesButton.addEventListener("click", async function () {
      const transaction = createTransactionFromForm();
      const stoData = [
        // Your STO JSON data
      ];
      const transactionForm = document.querySelector("#transactionForm");
      const preimages = await createSighashPreImages(transaction, stoData);
      displayPreImages(preimages);
    });
  }
}); */

document.querySelectorAll('.hashButton').forEach((button) => {
  button.addEventListener('click', async (event) => {
    const formData = 'your-form-data'; // Replace this with the serialized form data

    const hash = await callBackendHashing(formData);
    // Display the hash in the form
    // You'll need to add an input element for each Preimage JSON container to display the hash
    event.target.parentElement.querySelector('.hashResult').value = hash;
  });
});

/* document.getElementById("processTransactionDataButton").addEventListener("click", () => {
  // Create transaction object from form data
  const transaction = createTransactionFromForm();

  // Get the input count from the transaction object
  const inputCount = transaction.inputs.length;

  // Call the displayPreImages function with the input count
  displayPreImages(inputCount);
}); */

document.getElementById("processTransactionDataButton").addEventListener("click", () => {
  const inputCount = parseInt(document.querySelector("#inputCount").value); // Get input count from the form
  displayPreImages(inputCount);
});




document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#generatekeypair').addEventListener('click', generateKeyPair);
  document.querySelector('#mineBlocks').addEventListener('click', mineBlocks);
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createSighashButton').addEventListener('click', async () => {
    const transaction = createTransactionFromForm();
    const preimages = createSighashPreImages(transaction);
    const sighashes = [];
  
    for (const preimage of preimages) {
      const hash = await callBackendHashing(preimage);
      sighashes.push(hash);
    }
  
    displaySighashes(sighashes);
  });
});


// Add event listeners to the buttons
document.getElementById('generatekeypair').addEventListener('click', generateKeyPair);
document.getElementById('mineBlocks').addEventListener('click', mineBlocks);
document.getElementById('signSigHash').addEventListener('click', signSigHash);
document.getElementById('generateRawTx').addEventListener('click', generateRawTx);
document.getElementById('generateTXID').addEventListener('click', generateTXID);
document.getElementById('broadcastTX').addEventListener('click', broadcastTX);

// Update the input/output related functions
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('inputCount').addEventListener('input', createInputContainers);
  document.getElementById('outputCount').addEventListener('input', createOutputContainers);
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
    displaySpendableTransactionOutputs(minedData.transactions);
  } catch (error) { // Add this catch block
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

function createSpendableTransactionOutput(index, txDetails, output, selectedPrivateKey) {
  const lockScriptSize = output.scriptPubKey.hex.length / 2;
  const unlockScriptSize = output.scriptPubKey.hex.length / 2;

  return {
    index: index,
    blockHeight: txDetails.blockheight,
    blockHash: txDetails.blockhash,
    vout: output.n,
    txid: txDetails.txid,
    value: output.value,
    lockScriptSize: lockScriptSize,
    lockScriptAsm: output.scriptPubKey.asm,
    lockScriptHex: output.scriptPubKey.hex,
    reqSigs: output.scriptPubKey.reqSigs,
    confirmations: txDetails.confirmations,
    privateKey: selectedPrivateKey,
    unlockScriptSize: unlockScriptSize,
    unlockScript: output.scriptPubKey.hex,
    sequence: 0xffffffff,
    sighashFlag: '01',
  };
}


async function fetchSTODetails(sto) {
  return {
    txid: sto.txid,
    vout: sto.vout,
    value: sto.value,
    unlockScript: sto.unlockScript,
    sequence: sto.sequence,
    sighashFlag: sto.sighashFlag,
  };
}

async function displaySpendableTransactionOutputs(transactions) {
  const stoContainer = document.querySelector("#stoContainer");
  const keyPairSelector = document.querySelector("#keyPairSelector");
  const selectedIndex = keyPairSelector.value;

  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const privateKeyCell = selectedRow.children[2];
  const selectedPrivateKey = privateKeyCell.innerText;

  stoContainer.innerHTML = ""; // clear the container before populating new data

  const spendableTransactionOutputs = [];

  const transactionPromises = transactions.map(async (transaction, index) => {
    const txDetails = await fetchTransactionDetails(transaction.txid);
    const output = txDetails.vout[0];
    const sto = createSpendableTransactionOutput(index + 1, txDetails, output, selectedPrivateKey);
    spendableTransactionOutputs.push(sto);
  });

  await Promise.all(transactionPromises);

  // Sort spendable transaction outputs by block height
  spendableTransactionOutputs.sort((a, b) => a.blockHeight - b.blockHeight);

  // Display spendable transaction outputs
  spendableTransactionOutputs.forEach((spendableTransactionOutput, index) => {
    const stoElement = document.createElement("pre");
    stoElement.id = `sto-json-${index + 1}`;
    stoElement.className = "sto-json";
    stoElement.style.display = index === 0 ? "block" : "none";
    stoElement.innerText = JSON.stringify(spendableTransactionOutput, null, 2);
    stoContainer.appendChild(stoElement);
  });

  // Create pagination navigation
  const paginationNav = document.createElement("div");
  paginationNav.className = "pagination-nav";

  spendableTransactionOutputs.forEach((_, index) => {
    const navLink = document.createElement("a");
    navLink.href = "#";
    navLink.innerText = index + 1;
    navLink.addEventListener("click", (e) => {
      e.preventDefault();
      showStoElement(index);
    });

    paginationNav.appendChild(navLink);
  });

  stoContainer.appendChild(paginationNav);

  // Return the spendable transaction outputs
  return spendableTransactionOutputs;
}

function showStoElement(index) {
  const stoElements = document.querySelectorAll(".sto-json");

  stoElements.forEach((element, i) => {
    element.style.display = i === index ? "block" : "none";
  });
}


function getTransactionVersionValue() {
  return getElementValueById('version');
}

function getElementValueById(id, index) {
  let element;
  if (index === undefined) {
    element = document.getElementById(id) || document.getElementById(capitalizeFirstLetter(id));
  } else {
    element = document.getElementById(`${id}-${index}`) || document.getElementById(`${capitalizeFirstLetter(id)}-${index}`);
  }
  return element ? element.value : null;
}



function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function createTransactionFromForm() {
  const transaction = {
    version: getTransactionVersionValue(),
  };
  const transactionLockTime = document.querySelector("#nLockTime").value;

  const inputCount = parseInt(document.querySelector('#inputCount').value);
  const inputs = [];
  for (let i = 0; i < inputCount; i++) {
    const inputElement = document.getElementById(`inputContainer-${i}`);
    if (inputElement) {
      inputs.push({
        txid: getElementValueById('inputTXID', i),
        vout: getElementValueById('inputVOUT', i),
        sequence: getElementValueById('inputSequence', i),
        unlockScriptSize: getElementValueById('inputUnlockScriptSize', i),
        unlockScript: getElementValueById('inputUnlockScript', i),
        sighashFlag: getElementValueById('sighashFlag', i)
      });
    }
     // Add inputs to the transaction object
  transaction.inputs = inputs;

  // Return the transaction object
  return transaction;
}
  

  const outputCount = parseInt(document.querySelector('#outputCount').value);
  const outputs = [];
  for (let i = 0; i < outputCount; i++) {
    const outputElement = document.getElementById(`outputContainer-${i}`);
    if (outputElement) {
      outputs.push({
        value: getElementValueById('outputValue', i),
        lockScriptSize: getElementValueById('outputlockScriptSize', i),
        lockScript: getElementValueById('outputlockScript', i),
      });
    }
  }

  return { ...transaction, inputs, outputs, nLockTime: transactionLockTime };

  
}

const stoData = [
  // Your STO JSON data
  
];

/* const preImages = await createSighashPreImages(transactionForm, stoData);
 */
const SIGHASH_ALL = 0x01;
const SIGHASH_NONE = 0x02;
const SIGHASH_SINGLE = 0x03;
const SIGHASH_FORKID = 0x40;
const SIGHASH_ANYONECANPAY = 0x80;

const SIGHASH_ALL_ANYONECANPAY = SIGHASH_ALL | SIGHASH_ANYONECANPAY;
const SIGHASH_NONE_ANYONECANPAY = SIGHASH_NONE | SIGHASH_ANYONECANPAY;
const SIGHASH_SINGLE_ANYONECANPAY = SIGHASH_SINGLE | SIGHASH_ANYONECANPAY;


async function callBackendHashing(data) {
  const response = await fetch('http://203.18.30.236:8090/api/double-sha256', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ data }),
  });

  const result = await response.json();
  return result.hash;
}


async function hashPrevouts(inputs) {
  let buffer = "";
  for (const input of inputs) {
    buffer += input.txid + input.vout;
  }
  return await callBackendHashing(buffer);
}

async function hashSequence(inputs) {
  let buffer = "";
  for (const input of inputs) {
    buffer += input.sequence;
  }
  return await callBackendHashing(buffer);
}

async function hashOutputs(outputs) {
  let buffer = "";
  for (const output of outputs) {
    buffer += output.value + output.lockScriptSize + output.lockScript;
  }
  return await callBackendHashing(buffer);
}

async function hashSingleOutput(output) {
  const buffer = output.value + output.lockScriptSize + output.lockScript;
  return await callBackendHashing(buffer);
}



/* async function createSighashPreImages(transaction, stoData) {
  const preimages = [];
  for (let i = 0; i < transaction.inputs.length; i++) {
    const input = transaction.inputs[i];
    const sighashFlag = parseInt(input.sighashFlag);

    // Create a preimage object based on the SIGHASH flag and input data
    const preimage = {
      nVersion: transaction.version,
      hashPrevouts: (sighashFlag & 0x80) ? '0000000000000000000000000000000000000000000000000000000000000000' : await hashPrevouts(transaction.inputs),
      hashSequence: (sighashFlag & 0x80 || (sighashFlag & 0x1f) === 0x02 || (sighashFlag & 0x1f) === 0x03) ? '0000000000000000000000000000000000000000000000000000000000000000' : await hashSequence(transaction.inputs),
      outpoint: input.txid + input.vout,
      scriptCode: input.unlockScriptSize + input.unlockScript,
      value: input.value,
      nSequence: input.sequence,
      hashOutputs: (sighashFlag & 0x1f) === 0x01 ? await hashOutputs(transaction.outputs) : (sighashFlag & 0x1f) === 0x03 ? await hashSingleOutput(transaction.outputs[i]) : '0000000000000000000000000000000000000000000000000000000000000000',
      nLockTime: transaction.nLockTime,
      nHashType: input.sighashFlag
    };
    preimages.push(preimage);
  }
  return preimages;
} */

function displayPreImages(inputCount) {
  const preimagesContainer = document.getElementById("preimagesContainer");

  // Remove existing preimage JSON containers
  preimagesContainer.querySelectorAll(".preimageJSON").forEach((container) => {
    preimagesContainer.removeChild(container);
  });

  // Create new preimage JSON containers
  const preimageJSONTemplate = document.getElementById("preimageJSONTemplate");
  for (let i = 0; i < inputCount; i++) {
    const newContainer = preimageJSONTemplate.content.cloneNode(true);
    newContainer.querySelector(".preimageIndex").textContent = i + 1;

    // Set unique IDs for each form field
    const formFields = newContainer.querySelectorAll(".form-control");
    formFields.forEach((field) => {
      field.id = field.classList.item(1) + "-" + i;
    });

    // Set unique ID for each hash button
    const hashButtons = newContainer.querySelectorAll(".hashButton");
    hashButtons.forEach((button, index) => {
      button.id = "hashButton-" + index + "-" + i;
    });

    preimagesContainer.appendChild(newContainer);
  }
}









function parseVarInt(hex, start) {
  const firstByte = parseInt(hex.substr(start * 2, 2), 16);
  let value;
  let size;

  if (firstByte < 0xfd) {
    value = hex.substr(start * 2, 2);
    size = 1;
  } else if (firstByte === 0xfd) {
    value = hex.substr((start + 1) * 2, 4);
    size = 3;
  } else if (firstByte === 0xfe) {
    value = hex.substr((start + 1) * 2, 8);
    size = 5;
  } else {
    value = hex.substr((start + 1) * 2, 16);
    size = 9;
  }

  return { value, size };
}


function toVarInt(value) {
  if (value < 0xfd) {
    return value.toString(16).padStart(2, "0");
  } else if (value <= 0xffff) {
    return "fd" + value.toString(16).padStart(4, "0");
  } else if (value <= 0xffffffff) {
    return "fe" + value.toString(16).padStart(8, "0");
  } else {
    return "ff" + value.toString(16).padStart(16, "0");
  }
}

function intToHexString(value, byteSize) {
  return value.toString(16).padStart(byteSize * 2, "0");
}

function createInputContainers(event) {
  updateInputOrOutputContainers("input", event);
}

function createOutputContainers(event) {
  updateInputOrOutputContainers("output", event);
}

document.getElementById("inputCount").addEventListener("change", (event) => {
  createInputContainers(event);
});

document.getElementById("outputCount").addEventListener("change", (event) => {
  createOutputContainers(event);
});


function updateInputOrOutputContainers(containerType, event) {
  if (event) {
    event.preventDefault();
  }

  const countField = document.querySelector(`#${containerType}Count`);
  const countHex = countField.value;
  const count = parseInt(parseVarInt(countHex, 0).value, 16);
  const maxCount = 5;

  console.log(`${containerType} count:`, count);

  if (count <= maxCount) {
    const containers = document.getElementById(`${containerType}Containers`);
    const containerTemplate = document.getElementById(`${containerType}ContainerTemplate`);

    // Remove existing containers with the same type
    containers.querySelectorAll(`.${containerType}Container`).forEach((container) => {
      containers.removeChild(container);
    });

    for (let i = 0; i < count; i++) {
      const newContainer = containerTemplate.content.cloneNode(true);
      newContainer.firstElementChild.id = `${containerType}Container-${i}`;
      newContainer.firstElementChild.classList.add(`${containerType}Container`);
  
      // Set unique ids for the fields
      newContainer.querySelectorAll("input, select").forEach((element) => {
        const name = element.getAttribute("name");
        element.id = `${name}-${i}`;
      });
  
      containers.appendChild(newContainer);
    }
  } else {
    alert(`You can add a maximum of 5 ${containerType} containers.`);
  }
}




/* const SIGHASH_ALL = '41';
const SIGHASH_NONE = '42';
const SIGHASH_SINGLE = '43';
const ANYONECANPAY = '80';

const SIGHASH_ALL_ANYONECANPAY = SIGHASH_ALL | ANYONECANPAY;
const SIGHASH_NONE_ANYONECANPAY = SIGHASH_NONE | ANYONECANPAY;
const SIGHASH_SINGLE_ANYONECANPAY = SIGHASH_SINGLE | ANYONECANPAY;

async function callBackendHashing(hexString) {
  const buffer = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16))).buffer;
  const firstHash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  const secondHash = new Uint8Array(await crypto.subtle.digest('SHA-256', firstHash));
  return Array.from(secondHash).map(b => b.toString(16).padStart(2, '0')).join('');
} */

/* function displaySighashes(sighashes) {
  const sighashContainer = document.getElementById("sighashContainer");
  sighashContainer.innerHTML = ""; // Clear previous content

  sighashes.forEach((sighash, index) => {
    const sighashDiv = document.createElement("div");
    sighashDiv.classList.add("mb-3");

    const sighashLabel = document.createElement("label");
    sighashLabel.textContent = `Input ${index + 1} Sighash:`;
    sighashDiv.appendChild(sighashLabel);

    const sighashPre = document.createElement("pre");
    sighashPre.classList.add("border", "p-2");
    sighashPre.textContent = sighash;
    sighashDiv.appendChild(sighashPre);

    sighashContainer.appendChild(sighashDiv);
  });
} */
