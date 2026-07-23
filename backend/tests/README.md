Run backend regression tests from the `backend` directory:

```bash
python -m unittest discover -s tests -p 'test_*.py'
```

JavaScript N-UP behavior currently has a documented browser regression contract in `test_nup_contract.md` until browser E2E coverage is added.
