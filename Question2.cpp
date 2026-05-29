// Advanced Algorithms
// Question 2

#include <iostream>
using namespace std;

int i = 1;
void resTowerOfHanoi(int n, char from, char mid, char to) {
	if (n == 0) {
		return;
	}
	resTowerOfHanoi(n - 1, from, to, mid);
	cout << "Move no. " << i++ << ": Move disk " << n 
		<< " from rod " << from << " to rod " << mid << endl;

	resTowerOfHanoi(n - 1, to, from, mid);
	cout << "Move no. " << i++ << ": Move disk " << n 
		<< " from rod " << mid << " to rod " << to << endl;

	resTowerOfHanoi(n - 1, from, to, mid);
}

int main() {
	int m;
	cout << "Enter the number of disks : ";
	cin >> m;
	if (m< 1) {
		cout << "Please enter a positive integer. ";
		return 0;
	}
	resTowerOfHanoi(m, 'A', 'B', 'C');
	cout << "\nTotal move = " << pow(3, m) - 1 << endl;

}