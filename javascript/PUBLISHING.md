# Publier @sahelpay/sdk 1.2.0

1. Récupérer main backend, relire OpenAPI et les PR produit fusionnées ; comparer le
   snapshot avec `python3 scripts/sync-billing-contract.py <openapi> --revision <SHA> --check`.
2. Exécuter typecheck/build/tests deux fois et valider Mintlify, Python, PHP.
3. Après merge, créer le tag `javascript-v1.2.0` sur le commit livré.
4. Depuis `javascript`, vérifier `npm whoami` (ne jamais afficher de token).
5. Si authentifié et sans 2FA bloquante :

```sh
npm publish --access public --provenance=false --ignore-scripts
```

Construire avant `--ignore-scripts`. Ne pas démarrer de login ou demander de secret
en chat. Sans accès, conserver le tag et cette commande pour le propriétaire.
Vérifier ensuite `npm view @sahelpay/sdk@1.2.0 version`, installer le tarball publié
et exécuter un exemple Billing hors réseau sur le paquet installé.

Python : tag `python-v1.2.0`, construire `python -m build --outdir /tmp/sahelpay-python-dist python`, puis
`python -m twine upload /tmp/sahelpay-python-dist/*` uniquement si l'identité PyPI est configurée.
PHP : tag monorepo `php-v1.2.0` ; Packagist a besoin d'un dépôt dédié/split dont
`composer.json` est à la racine. Le tag monorepo seul ne publie pas le sous-dossier.
Installer par path repository en attendant. Aucun jeton n'est requis pour tester.
