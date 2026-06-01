import { useEffect, useState } from 'react';
import { api, type StandardProduct } from '../../../api';

export function useProductCascade() {
  const [activityId, setActivityId] = useState('');
  const [costCenters, setCostCenters] = useState<{ code: string; name: string }[]>([]);
  const [costCenter, setCostCenter] = useState('');
  const [prodCode, setProdCode] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<StandardProduct[]>([]);
  const [showProductList, setShowProductList] = useState(false);

  useEffect(() => {
    api.costCenters(activityId ? Number(activityId) : undefined).then((ccs) => {
      setCostCenters(ccs);
      setCostCenter((prev) => (prev && !ccs.some((c) => c.code === prev) ? '' : prev));
    });
  }, [activityId]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (productSearch.length >= 1 || costCenter) {
        api
          .standardProducts({
            q: productSearch.length >= 1 ? productSearch : undefined,
            cost_center_code: costCenter || undefined,
          })
          .then(setProducts);
      } else {
        setProducts([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [productSearch, costCenter]);

  function onActivityChange(id: string) {
    setActivityId(id);
    setCostCenter('');
    setProdCode('');
    setProductSearch('');
    setShowProductList(false);
  }

  function onCostCenterChange(code: string) {
    setCostCenter(code);
    setProdCode('');
    setProductSearch('');
    setShowProductList(false);
  }

  function selectProduct(p: StandardProduct) {
    setProdCode(p.prod_code);
    setProductSearch(`${p.prod_code} — ${p.prod_name}`);
    setShowProductList(false);
  }

  return {
    activityId,
    costCenters,
    costCenter,
    prodCode,
    setProdCode,
    productSearch,
    setProductSearch,
    products,
    showProductList,
    setShowProductList,
    onActivityChange,
    onCostCenterChange,
    selectProduct,
    costCenterEnabled: Boolean(activityId),
    productEnabled: Boolean(costCenter),
  };
}
