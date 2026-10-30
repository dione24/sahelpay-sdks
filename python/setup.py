from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="sahelpay",
    version="1.3.0",
    author="SahelPay",
    author_email="dev@sahelpay.ml",
    description="SDK officiel SahelPay pour Python - Paiements Mobile Money en Afrique de l'Ouest",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/dione24/sahelpay-sdks",
    project_urls={
        "Documentation": "https://docs.sahelpay.ml",
        "Bug Tracker": "https://github.com/dione24/sahelpay-sdks/issues",
    },
    license="MIT",
    package_data={"sahelpay": ["py.typed"]},
    packages=find_packages(exclude=("tests", "tests.*")),
    classifiers=[
        "Development Status :: 5 - Production/Stable",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Software Development :: Libraries :: Python Modules",
        "Topic :: Office/Business :: Financial :: Point-Of-Sale",
    ],
    python_requires=">=3.8",
    keywords=[
        "sahelpay",
        "payment",
        "mobile-money",
        "orange-money",
        "wave",
        "moov",
        "mali",
        "senegal",
        "africa",
        "fintech",
        "api",
        "sdk",
    ],
)
