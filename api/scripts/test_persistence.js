// Native fetch used

const UPDATE_URL = 'http://127.0.0.1:4000/products/update'; // Adjust port if needed
const GET_URL = 'http://127.0.0.1:4000/products';

async function main() {
  // 1. Find a product to test on
  console.log('Fetching products...');
  let res = await fetch(GET_URL);
  if (!res.ok) {
     res = await fetch('http://localhost:3000/api/products'); // Try with /api prefix just in case
     if (!res.ok) {
        console.error('Could not fetch products. Check server URL/Port.');
        return;
     }
  }
  
  const products = await res.json();
  if (products.length === 0) {
    console.log('No products found to test.');
    return;
  }
  
  const p = products[0];
  console.log(`Testing on Product: ${p.nome} (ID: ${p.id})`);
  console.log('Current permeteMeioAMeio:', p.permiteMeioAMeio);

  // 2. Update it to TRUE
  const updateUrl = `http://localhost:3000/products/update/${p.id}`;
  console.log(`Updating ${updateUrl} with permitsMeioAMeio: true...`);
  
  const updatePayload = {
     ...p,
     permiteMeioAMeio: true,
     regraVariacao: 'media'
  };
  
  const updateRes = await fetch(updateUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatePayload)
  });
  
  if (!updateRes.ok) {
      console.error('Update failed:', updateRes.status, await updateRes.text());
      return;
  }
  console.log('Update OK.');

  // 3. Fetch again to verify
  const checkRes = await fetch(`${GET_URL}/${p.id}`);
  const updatedP = await checkRes.json();
  
  console.log('New permeteMeioAMeio:', updatedP.permiteMeioAMeio);
  console.log('New regraVariacao:', updatedP.regraVariacao);
  
  if (updatedP.permiteMeioAMeio === true) {
     console.log('SUCCESS: Persistence working.');
  } else {
     console.log('FAILURE: Persistence NOT working (Server might need restart).');
  }
}

main().catch(console.error);
