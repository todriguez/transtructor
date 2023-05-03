document.addEventListener("DOMContentLoaded", function() {
  const displayPreImagesButton = document.getElementById("displayPreImagesButton");
  if (displayPreImagesButton) {
    displayPreImagesButton.addEventListener("click", function() {
      const transaction = createTransactionFromForm();
      const preimages = createSighashPreimages(transaction);
      displayPreImages(preimages);
    });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelector('#generatekeypair').addEventListener('click', generateKeyPair);
  document.querySelector('#mineBlocks').addEventListener('click', mineBlocks);
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('createSighashButton').addEventListener('click', async () => {
    const transaction = createTransactionFromForm();
    const preimages = createSighashPreimages(transaction);
    const sighashes = [];
  
    for (const preimage of preimages) {
      const hash = await doubleSha256(preimage);
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

function createSpendableTransactionOutput(transaction, output, selectedPrivateKey) {
  return {
    index: transaction.n,
    blockHeight: transaction.blockheight,
    blockHash: transaction.blockhash,
    vout: output.n,
    txid: transaction.txid,
    value: output.value,
    lockScriptAsm: output.scriptPubKey.asm,
    lockScriptHex: output.scriptPubKey.hex,
    reqSigs: output.scriptPubKey.reqSigs,
    confirmations: transaction.confirmations,
    privateKey: selectedPrivateKey,
  };
}

async function populateSpendableTransactionOutputs(transactions) {
  const stoTableBody = document.querySelector("#stoTable > tbody");
  const keyPairSelector = document.querySelector("#keyPairSelector");
  const selectedIndex = keyPairSelector.value;

  const keyPairTableBody = document.getElementById("keypairTableBody");
  const selectedRow = keyPairTableBody.children[selectedIndex - 1];
  const privateKeyCell = selectedRow.children[2];
  const selectedPrivateKey = privateKeyCell.innerText;

  stoTableBody.innerHTML = ""; // clear the table before populating new data

  const transactionPromises = transactions.map(async (transaction) => {
    const txDetails = await fetchTransactionDetails(transaction.txid);
    const output = txDetails.vout[0];
    const sto = createSpendableTransactionOutput(transaction, output, selectedPrivateKey);

    const newRow = document.createElement("tr");

    Object.keys(sto).forEach((key, index) => {
      let cell = newRow.insertCell();
      cell.innerText = sto[key];
    });

    stoTableBody.appendChild(newRow);
  });

  await Promise.all(transactionPromises);
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


/* function createSighashPreimages(transaction) {
  if (Array.isArray(transaction.inputs)) {
    const preimages = transaction.inputs.map((input, index) => {
      const preimageParts = [
        transaction.version,
        toVarInt(transaction.inputs.length),
        ...transaction.inputs.map(({ txid, vout, unlockScript, sequence }) => txid + vout + toVarInt(unlockScript.length / 2) + unlockScript + sequence),
        toVarInt(transaction.outputs.length),
        ...transaction.outputs.map(({ value, lockScript }) => value + toVarInt(lockScript.length / 2) + lockScript),
        transaction.nLockTime,
        intToHexString(input.sighashFlag, 1),
      ];
      return preimageParts.join('');
    });
    console.log('preimages:', preimages);
    return preimages;
  } else {
    return [];
  }
} */

function createSighashPreimages(transaction) {
  if (Array.isArray(transaction.inputs)) {
    const preimages = transaction.inputs.map((input, index) => {
      const preimageParts = [
        transaction.version,
        toVarInt(transaction.inputs.length),
        ...transaction.inputs.map(({ txid, vout, unlockScriptSize, unlockScript, sequence }) => txid + vout + unlockScriptSize + unlockScript + sequence),
        toVarInt(transaction.outputs.length),
        ...transaction.outputs.map(({ value, lockScriptSize, lockScript }) => value + lockScriptSize + lockScript),
        transaction.nLockTime,
        input.sighashFlag.padStart(2, '0'),
      ];
      const serializedPreimage = preimageParts.join('');

      const transactionJSON = {
        version: transaction.version,
        nLockTime: transaction.nLockTime,
        sighashFlag: input.sighashFlag,
      };

      // Determine which parts of the transaction to include in JSON object based on the SIGHASH flag
      const sighashFlagNoForkId = parseInt(input.sighashFlag, 16) & ~0x40;
      const anyoneCanPay = (sighashFlagNoForkId & 0x80) !== 0;

      if (!anyoneCanPay) {
        transactionJSON.inputCount = transaction.inputs.length;
        transactionJSON.inputs = transaction.inputs.map(({ txid, vout, unlockScriptSize, unlockScript, sequence }) => ({ txid, vout, unlockScriptSize, unlockScript, sequence }));
      } else {
        transactionJSON.inputs = [{ ...transaction.inputs[index] }];
      }

      switch (input.sighashFlag) {
        case SIGHASH_ALL:
        case SIGHASH_ALL_ANYONECANPAY:
          transactionJSON.outputCount = transaction.outputs.length;
          transactionJSON.outputs = transaction.outputs.map(({ value, lockScriptSize, lockScript }) => ({ value, lockScriptSize, lockScript }));
          break;
        case SIGHASH_NONE:
        case SIGHASH_NONE_ANYONECANPAY:
          break;
        case SIGHASH_SINGLE:
        case SIGHASH_SINGLE_ANYONECANPAY:
          if (index <= transaction.outputs.length - 1) {
            transactionJSON.outputs = [{ ...transaction.outputs[index] }];
          } else {
            throw new Error(`SIGHASH_SINGLE cannot be used when input number is greater than output number.`);
          }
          break;
        default:
          throw new Error(`Unsupported SIGHASH flag: ${input.sighashFlag}`);
      }
      
      return { serializedPreimage, transactionJSON };
    });

    console.log('preimages:', preimages);
    return preimages;
  } else {
    return [];
  }
}










/* function displayPreImages(preimages) {
  const preImageContainer = document.getElementById("preImageContainer");
  preImageContainer.innerHTML = ""; // Clear previous content

  preimages.forEach((preImage, index) => {
    const preImageDiv = document.createElement("div");
    preImageDiv.classList.add("mb-3");

    const preImageLabel = document.createElement("label");
    preImageLabel.textContent = `Input ${index + 1} PreImage:`;
    preImageDiv.appendChild(preImageLabel);

    const preImagePre = document.createElement("pre");
    preImagePre.classList.add("border", "p-2");
    preImagePre.textContent = preImage; // Display the raw serialized sighash preimage
    preImageDiv.appendChild(preImagePre);

    preImageContainer.appendChild(preImageDiv);
  });
} */

function displayPreImages(preimages) {
  const preImageContainer = document.getElementById("preImageContainer");
  preImageContainer.innerHTML = ""; // Clear previous content

  preimages.forEach(({ serializedPreimage, transactionJSON }, index) => {
    const preImageDiv = document.createElement("div");
    preImageDiv.classList.add("mb-3");

    const preImageLabel = document.createElement("label");
    preImageLabel.textContent = `Input ${index + 1} PreImage:`;
    preImageDiv.appendChild(preImageLabel);

    const preImagePre = document.createElement("pre");
    preImagePre.classList.add("border", "p-2");
    preImagePre.textContent = serializedPreimage; // Display the raw serialized sighash preimage
    preImageDiv.appendChild(preImagePre);

    const preImageJSONLabel = document.createElement("label");
    preImageJSONLabel.textContent = `Input ${index + 1} PreImage JSON:`;
    preImageDiv.appendChild(preImageJSONLabel);

    const preImageJSONPre = document.createElement("pre");
    preImageJSONPre.classList.add("border", "p-2");
    preImageJSONPre.textContent = JSON.stringify(transactionJSON, null, 2); // Display the JSON object of the constituent parts
    preImageDiv.appendChild(preImageJSONPre);

    preImageContainer.appendChild(preImageDiv);
  });
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




const SIGHASH_ALL = '41';
const SIGHASH_NONE = '42';
const SIGHASH_SINGLE = '43';
const ANYONECANPAY = '80';

const SIGHASH_ALL_ANYONECANPAY = SIGHASH_ALL | ANYONECANPAY;
const SIGHASH_NONE_ANYONECANPAY = SIGHASH_NONE | ANYONECANPAY;
const SIGHASH_SINGLE_ANYONECANPAY = SIGHASH_SINGLE | ANYONECANPAY;

async function doubleSha256(hexString) {
  const buffer = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16))).buffer;
  const firstHash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
  const secondHash = new Uint8Array(await crypto.subtle.digest('SHA-256', firstHash));
  return Array.from(secondHash).map(b => b.toString(16).padStart(2, '0')).join('');
}

function displaySighashes(sighashes) {
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
}
